import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/exchange-rates';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  try {
    const rates = await getExchangeRates(forceRefresh);
    return NextResponse.json(rates, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '汇率获取失败',
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
