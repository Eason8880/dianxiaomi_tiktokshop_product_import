import { NextRequest, NextResponse } from 'next/server';
import { translateAICategoryReasons } from '@/lib/category-translation';
import { getAccessToken } from '@/lib/tiktok-token';
import { fetchLeafCategories, fetchLocalizedCategoryPathMap } from '@/lib/tiktok-category-tree';
import { analyzeCategoryWithOpenRouter } from '@/lib/openrouter-category-match';

interface AICategoryRequest {
  productTitle: string;
  categoryLookupTitle?: string;
  region: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AICategoryRequest = await request.json();
    const { productTitle, categoryLookupTitle, region } = body;

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

    const analyzedTitle = String(categoryLookupTitle || productTitle || '').trim();
    if (!analyzedTitle) {
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
    const leafCategories = await fetchLeafCategories(appKey, appSecret, shopCipher, accessToken);
    const localizedPathMap = await fetchLocalizedCategoryPathMap(appKey, appSecret, shopCipher, accessToken);
    const result = await analyzeCategoryWithOpenRouter(analyzedTitle, leafCategories);
    const localizedCandidates = result.candidates.map((candidate) => ({
      ...candidate,
      categoryPath: localizedPathMap.get(candidate.categoryId) || candidate.categoryPath,
    }));
    const translatedCandidates = await translateAICategoryReasons(localizedCandidates);

    return NextResponse.json({
      ...result,
      candidates: translatedCandidates,
    });
  } catch (error) {
    console.error('TikTok Category AI API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 类目分析失败' },
      { status: 500 }
    );
  }
}
