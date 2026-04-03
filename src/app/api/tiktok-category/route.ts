import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAccessToken } from '@/lib/tiktok-token';

interface RecommendCategoryRequest {
  productTitle: string;
  description?: string;
  images?: string[];
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

  const result = crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex');

  console.log('[Sign Debug] sortedKeys:', sortedKeys);
  console.log('[Sign Debug] baseString (no secret):', baseString);
  console.log('[Sign Debug] sign:', result);

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendCategoryRequest = await request.json();
    const { productTitle, description, images, region } = body;

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

    const apiPath = '/product/202309/categories/recommend';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const requestBody: Record<string, unknown> = {
      product_title: productTitle,
    };
    if (description) {
      requestBody.description = description;
    }
    if (images && images.length > 0) {
      requestBody.images = images.map((url) => ({ uri: url }));
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

    const categories = data.data?.categories || data.data?.category_list || [];
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('TikTok Category API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'API 请求失败' },
      { status: 500 }
    );
  }
}
