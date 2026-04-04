import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouterChat, isOpenRouterConfigured, parseOpenRouterJson } from '@/lib/openrouter';

interface ProductInput {
  erpId: string;
  chineseName: string;
  attributes: string[];
}

interface AnalyzeVariantsRequest {
  products: ProductInput[];
}

interface SingleResult {
  erpId: string;
  dimensions: 1 | 2;
  dim1_name: string;
  dim2_name?: string;
  splits: Record<string, string[]>;
}

interface AIResponse {
  results: SingleResult[];
}

function sanitizeResults(raw: AIResponse, products: ProductInput[]): SingleResult[] {
  const inputIds = new Set(products.map((p) => p.erpId));
  const attrsByErpId = new Map(products.map((p) => [p.erpId, new Set(p.attributes)]));

  return (raw.results || [])
    .filter((r) => typeof r.erpId === 'string' && inputIds.has(r.erpId))
    .map((r) => {
      const dims = r.dimensions === 2 ? 2 : 1;
      const dim1 = typeof r.dim1_name === 'string' && r.dim1_name.trim() ? r.dim1_name.trim() : 'Color';
      const dim2 = dims === 2 && typeof r.dim2_name === 'string' && r.dim2_name.trim()
        ? r.dim2_name.trim()
        : undefined;

      const attrs = attrsByErpId.get(r.erpId) || new Set<string>();
      const rawSplits: Record<string, string[]> =
        r.splits && typeof r.splits === 'object' ? r.splits : {};

      // Ensure every requested attribute has a splits entry
      const splits: Record<string, string[]> = {};
      for (const attr of attrs) {
        const parts = Array.isArray(rawSplits[attr]) ? rawSplits[attr] : [];
        if (dims === 2) {
          splits[attr] = [
            typeof parts[0] === 'string' && parts[0] ? parts[0] : attr,
            typeof parts[1] === 'string' && parts[1] ? parts[1] : '',
          ];
        } else {
          splits[attr] = [typeof parts[0] === 'string' && parts[0] ? parts[0] : attr];
        }
      }

      return { erpId: r.erpId, dimensions: dims as 1 | 2, dim1_name: dim1, dim2_name: dim2, splits };
    });
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeVariantsRequest = await request.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: '缺少产品数据' }, { status: 400 });
    }

    if (!isOpenRouterConfigured()) {
      return NextResponse.json({ error: '未配置 OPENROUTER_API_KEY' }, { status: 500 });
    }

    const productList = products
      .map((p) => `{"erpId":"${p.erpId}","name":"${p.chineseName}","attributes":${JSON.stringify(p.attributes)}}`)
      .join(',\n  ');

    const { content } = await callOpenRouterChat({
      timeoutMs: 45_000,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a product variant dimension analyst for a Chinese e-commerce system targeting TikTok Shop.
Analyze variant attribute strings, determine their dimension structure, and translate all values to English.

Rules:
1. Dimension names must be in English: Color, Size, Length, Weight, Style, Material, Pattern, etc.
2. If all attributes represent a single concept (e.g. colors only, styles only), output dimensions=1.
3. If attributes combine two concepts (e.g. "黑色-XS" = Color + Size, "绿-1.2米" = Color + Length), output dimensions=2.
4. The splits map must include every attribute string from the input, exactly as provided as keys.
5. For dimensions=1 each splits entry has exactly one element: the English translation of the value.
6. For dimensions=2 each splits entry has exactly two elements: [English_dim1_value, English_dim2_value].
7. ALL split values must be in English. Translate Chinese color/size/style names to standard English (e.g. 黑色→Black, 红色→Red, 蓝色→Blue, 绿色→Green, 粉色→Pink, 白色→White, 灰色→Gray, 黄色→Yellow, 紫色→Purple, 橙色→Orange, 咖啡色→Coffee, 藏青→Navy Blue).
8. For sizes keep standard abbreviations: XS, S, M, L, XL, XXL. For lengths keep numeric+unit (e.g. "1.2M", "1.5M").
9. Be consistent: the same Chinese sub-string must always map to the same English value across a product.
10. Return only valid JSON, no markdown, no explanation.`,
        },
        {
          role: 'user',
          content: `Analyze these products and return their variant dimension structure.

Products:
[
  ${productList}
]

Example output for reference (note: all split values must be in English):
{
  "results": [
    {
      "erpId": "001",
      "dimensions": 2,
      "dim1_name": "Color",
      "dim2_name": "Size",
      "splits": {"黑色-XS": ["Black","XS"], "黑色-S": ["Black","S"], "蓝色-M": ["Blue","M"]}
    },
    {
      "erpId": "002",
      "dimensions": 1,
      "dim1_name": "Color",
      "splits": {"藏青": ["Navy Blue"], "卡其": ["Khaki"], "酒红": ["Wine Red"]}
    },
    {
      "erpId": "003",
      "dimensions": 2,
      "dim1_name": "Color",
      "dim2_name": "Length",
      "splits": {"绿-1.2米枪柄": ["Green","1.2M"], "蓝-1.5米枪柄": ["Blue","1.5M"]}
    }
  ]
}

Return JSON with a "results" array. Include every erpId from the input.`,
        },
      ],
    });

    const parsed = parseOpenRouterJson<AIResponse>(content);
    const results = sanitizeResults(parsed, products);

    // Add error entries for any erpId the AI omitted
    const returnedIds = new Set(results.map((r) => r.erpId));
    for (const p of products) {
      if (!returnedIds.has(p.erpId)) {
        results.push({
          erpId: p.erpId,
          dimensions: 1,
          dim1_name: 'Color',
          splits: Object.fromEntries(p.attributes.map((a) => [a, [a]])),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Variant analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '变种分析失败' },
      { status: 500 }
    );
  }
}
