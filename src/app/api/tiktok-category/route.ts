import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface RecommendCategoryRequest {
  productTitle: string;
  description?: string;
  images?: string[];
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
  // 1. Sort query params by key (excluding sign and access_token)
  const sortedKeys = Object.keys(queryParams)
    .filter((k) => k !== 'sign' && k !== 'access_token')
    .sort();

  // 2. Concatenate: path + sorted params + body
  let baseString = path;
  for (const key of sortedKeys) {
    baseString += key + queryParams[key];
  }
  baseString += body;

  // 3. Wrap with app_secret
  const signString = appSecret + baseString + appSecret;

  // 4. HMAC-SHA256
  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendCategoryRequest = await request.json();
    const { productTitle, description, images } = body;

    const appKey = process.env.TIKTOK_APP_KEY;
    const appSecret = process.env.TIKTOK_APP_SECRET;
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

    if (!appKey || !appSecret || !accessToken) {
      return NextResponse.json(
        { error: '服务端未配置 TikTok API 凭证，请联系管理员' },
        { status: 500 }
      );
    }

    if (!productTitle) {
      return NextResponse.json(
        { error: '缺少必要参数：productTitle' },
        { status: 400 }
      );
    }

    const apiPath = '/product/202309/categories/recommend';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const requestBody: Record<string, unknown> = {
      product_title: productTitle,
    };
    if (description) {
      requestBody.description = description;
    }
    if (images && images.length > 0) {
      requestBody.images = images.map((url) => ({ url }));
    }

    const bodyString = JSON.stringify(requestBody);

    const queryParams: Record<string, string> = {
      app_key: appKey,
      timestamp,
    };

    const sign = generateSignature(apiPath, queryParams, bodyString, appSecret);

    const queryString = new URLSearchParams({
      ...queryParams,
      sign,
      access_token: accessToken,
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

    // Extract category recommendations
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
