import { ExchangeRateCode, ExchangeRatesState } from '@/types';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { REQUIRED_EXCHANGE_RATE_CODES } from '@/lib/pricing-config';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rates';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface FrankfurterResponse {
  base?: string;
  date?: string;
  quote?: ExchangeRateCode;
  rate?: number;
}

interface ExchangeRateCacheEntry {
  data: ExchangeRatesState;
  expiresAt: number;
}

let cacheEntry: ExchangeRateCacheEntry | null = null;

function toExchangeRatesState(rows: FrankfurterResponse[]): ExchangeRatesState {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('汇率服务返回了空数据');
  }

  const validRows = rows.filter((row) => {
    return (
      row.base === 'USD' &&
      typeof row.date === 'string' &&
      Boolean(row.quote) &&
      typeof row.rate === 'number' &&
      Number.isFinite(row.rate) &&
      row.rate > 0
    );
  });

  if (validRows.length === 0) {
    throw new Error('汇率服务返回了无效数据');
  }

  const rowsByQuote = new Map<ExchangeRateCode, FrankfurterResponse[]>();
  for (const row of validRows) {
    const quote = row.quote as ExchangeRateCode;
    if (!REQUIRED_EXCHANGE_RATE_CODES.includes(quote)) {
      continue;
    }

    const quoteRows = rowsByQuote.get(quote) || [];
    quoteRows.push(row);
    rowsByQuote.set(quote, quoteRows);
  }

  const rates = {} as Record<ExchangeRateCode, number>;
  const rateDates = {} as Record<ExchangeRateCode, string>;

  for (const code of REQUIRED_EXCHANGE_RATE_CODES) {
    const quoteRows = rowsByQuote.get(code);
    if (!quoteRows || quoteRows.length === 0) {
      throw new Error(`汇率服务缺少 ${code} 报价`);
    }

    quoteRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const latestRow = quoteRows[0];
    rates[code] = latestRow.rate as number;
    rateDates[code] = latestRow.date as string;
  }

  const uniqueDates = Array.from(new Set(Object.values(rateDates))).sort();
  if (uniqueDates.length === 0) {
    throw new Error('汇率服务返回了不完整的数据');
  }

  return {
    base: 'USD',
    provider: 'frankfurter',
    providerDate: uniqueDates[uniqueDates.length - 1],
    rateDates,
    rates,
    fetchedAt: new Date().toISOString(),
    isStale: false,
  };
}

async function fetchFreshExchangeRates(): Promise<ExchangeRatesState> {
  const url = new URL(FRANKFURTER_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set('quotes', REQUIRED_EXCHANGE_RATE_CODES.join(','));

  const response = await fetchWithTimeout(url, {
    cache: 'no-store',
    timeoutMs: 15_000,
    timeoutMessage: '汇率服务请求超时，请稍后重试',
  });

  if (!response.ok) {
    throw new Error(`汇率服务响应失败：HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FrankfurterResponse[];
  return toExchangeRatesState(payload);
}

export async function getExchangeRates(forceRefresh = false): Promise<ExchangeRatesState> {
  const now = Date.now();
  if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > now) {
    return cacheEntry.data;
  }

  try {
    const fresh = await fetchFreshExchangeRates();
    cacheEntry = {
      data: fresh,
      expiresAt: now + CACHE_TTL_MS,
    };
    return fresh;
  } catch (error) {
    if (cacheEntry) {
      return {
        ...cacheEntry.data,
        isStale: true,
      };
    }

    throw error;
  }
}
