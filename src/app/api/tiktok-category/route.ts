import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAccessToken } from '@/lib/tiktok-token';

interface RecommendCategoryRequest {
  productTitle: string;
  description?: string;
  region: string;
}

/**
 * Generate TikTok Open API signature.
 * See: https://partner.tiktokshop.com/docv2/page/64f199e4defece02be598a4e
 */
function generateSignature(
  path: string,
  queryParams: Record<string, string>,
  body: string,
  appSecret: string
): string {
  const sortedKeys = Object.keys(queryParams)
    .filter((k) => k !== 'sign' && k !== 'access_token')
    .sort();

  let baseString = path;
  for (const key of sortedKeys) {
    baseString += key + queryParams[key];
  }
  baseString += body;

  const signString = appSecret + baseString + appSecret;

  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex');
}

interface TikTokCategory {
  id: string;
  name?: string;
  local_name?: string;
  parent_id?: string;
  is_leaf?: boolean;
  level?: number;
  permission_statuses?: string[];
}

/**
 * Fetch the full TikTok category tree and return a map of id -> ancestor path (names from root to self).
 */
async function fetchCategoryPathMap(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string
): Promise<Map<string, string[]>> {
  const apiPath = '/product/202309/categories';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const queryParams: Record<string, string> = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp,
    locale: 'en',
  };

  const sign = generateSignature(apiPath, queryParams, '', appSecret);

  const queryString = new URLSearchParams({ ...queryParams, sign }).toString();
  const apiUrl = `https://open-api.tiktokglobalshop.com${apiPath}?${queryString}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    console.error('[Category Tree] API error:', data.code, data.message);
    return new Map();
  }

  const categories: TikTokCategory[] = data.data?.category_list || data.data?.categories || [];

  // Build id -> category map
  const catMap = new Map<string, TikTokCategory>();
  for (const cat of categories) {
    catMap.set(String(cat.id), cat);
  }

  // Build id -> full path (names from root to self)
  const pathMap = new Map<string, string[]>();

  function buildPath(id: string): string[] {
    if (pathMap.has(id)) return pathMap.get(id)!;
    const cat = catMap.get(id);
    if (!cat) return [];
    const name = cat.local_name || cat.name || id;
    const parentId = String(cat.parent_id || '');
    if (!parentId || parentId === '0' || parentId === '') {
      const path = [name];
      pathMap.set(id, path);
      return path;
    }
    const parentPath = buildPath(parentId);
    const path = [...parentPath, name];
    pathMap.set(id, path);
    return path;
  }

  for (const cat of categories) {
    buildPath(String(cat.id));
  }

  return pathMap;
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

    // Fetch recommended category
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

    const sign = generateSignature(apiPath, queryParams, bodyString, appSecret);

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

    const data = await response.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { error: data.message || 'TikTok API 调用失败', code: data.code, data },
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

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('TikTok Category API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'API 请求失败' },
      { status: 500 }
    );
  }
}
