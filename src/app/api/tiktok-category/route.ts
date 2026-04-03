import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/tiktok-token';
import { generateCategoryTitleVariants } from '@/lib/category-title-variants';
import {
  fetchCategoryPathMap,
  generateTikTokSignature,
  TikTokCategory,
} from '@/lib/tiktok-category-tree';

interface RecommendCategoryRequest {
  productTitle: string;
  description?: string;
  region: string;
}

interface TikTokApiResponse {
  code: number;
  message?: string;
  data?: {
    categories?: TikTokCategory[];
    category_list?: TikTokCategory[];
  };
}

async function requestRecommendedCategories(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string,
  productTitle: string,
  description?: string
): Promise<TikTokApiResponse> {
  const apiPath = '/product/202309/categories/recommend';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const requestBody: Record<string, unknown> = {
    product_title: productTitle,
  };
  if (description) {
    requestBody.description = description;
  }

  const bodyString = JSON.stringify(requestBody);
  const queryParams: Record<string, string> = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp,
  };

  const sign = generateTikTokSignature(apiPath, queryParams, bodyString, appSecret);
  const queryString = new URLSearchParams({
    ...queryParams,
    sign,
  }).toString();

  const apiUrl = `https://open-api.tiktokglobalshop.com${apiPath}?${queryString}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tts-access-token': accessToken,
    },
    body: bodyString,
  });

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendCategoryRequest = await request.json();
    const { productTitle, description, region } = body;

    const appKey = process.env.TIKTOK_APP_KEY;
    const appSecret = process.env.TIKTOK_APP_SECRET;
    const shopsEnv = process.env.TIKTOK_SHOPS;

    if (!appKey || !appSecret) {
      return NextResponse.json(
        { error: '服务端未配置 TikTok API 凭证（APP_KEY / APP_SECRET）' },
        { status: 500 }
      );
    }

    if (!shopsEnv) {
      return NextResponse.json(
        { error: '服务端未配置 TIKTOK_SHOPS' },
        { status: 500 }
      );
    }

    if (!region) {
      return NextResponse.json(
        { error: '缺少必要参数：region' },
        { status: 400 }
      );
    }

    if (!productTitle) {
      return NextResponse.json(
        { error: '缺少必要参数：productTitle' },
        { status: 400 }
      );
    }

    let shops: Record<string, string>;
    try {
      shops = JSON.parse(shopsEnv);
    } catch {
      return NextResponse.json(
        { error: 'TIKTOK_SHOPS 格式错误，应为 JSON 对象' },
        { status: 500 }
      );
    }

    const shopCipher = shops[region];
    if (!shopCipher) {
      return NextResponse.json(
        { error: `未配置 ${region} 地区的店铺 cipher` },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const attemptedTitles = generateCategoryTitleVariants(productTitle);
    let data: TikTokApiResponse | null = null;
    let matchedTitle = productTitle;

    for (const candidateTitle of attemptedTitles) {
      const result = await requestRecommendedCategories(
        appKey,
        appSecret,
        shopCipher,
        accessToken,
        candidateTitle,
        description
      );

      if (result.code === 0) {
        data = result;
        matchedTitle = candidateTitle;
        break;
      }

      data = result;
      if (result.code !== 12019064) {
        break;
      }
    }

    if (!data || data.code !== 0) {
      return NextResponse.json(
        {
          error: data?.message || 'TikTok API 调用失败',
          code: data?.code,
          data,
          attemptedTitles,
        },
        { status: 400 }
      );
    }

    const rawCategories: TikTokCategory[] = data.data?.categories || data.data?.category_list || [];

    // Fetch full category tree to resolve hierarchy paths
    const pathMap = await fetchCategoryPathMap(appKey, appSecret, shopCipher, accessToken);

    const categories = rawCategories.map((cat) => {
      const id = String(cat.id || '');
      const path = pathMap.get(id) || [];
      return {
        ...cat,
        categoryPath: path,
      };
    });

    return NextResponse.json({
      categories,
      matchedTitle,
      attemptedTitles,
    });
  } catch (error) {
    console.error('TikTok Category API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'API 请求失败' },
      { status: 500 }
    );
  }
}
