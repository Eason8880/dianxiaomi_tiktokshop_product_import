import { CountryCode, ExchangeRateCode } from '@/types';

export const PACKAGE_HANDLING_FEE_CNY = 0.8;

export interface RoundRule {
  mode: 'round' | 'ceil' | 'none';
  digits: number;
}

export interface PricingPreset {
  countryCode: CountryCode;
  countryName: string;
  currencyCode: ExchangeRateCode;
  totalFeeRate: number;
  taxMultiplier: number;
  defaultDiscountRate: number;
  startWeightKg: number;
  stepWeightKg: number;
  startPrice: number;
  stepPrice: number;
  buyerShipping: number;
  discountedPriceRule: RoundRule;
  preDiscountPriceRule: RoundRule;
}

export const COUNTRY_OPTIONS: Array<{ value: CountryCode; label: string }> = [
  { value: 'PH', label: '菲律宾' },
  { value: 'MY', label: '马来西亚' },
  { value: 'SG', label: '新加坡' },
  { value: 'TH', label: '泰国' },
  { value: 'VN', label: '越南' },
];

export const REQUIRED_EXCHANGE_RATE_CODES: ExchangeRateCode[] = [
  'CNY',
  'PHP',
  'MYR',
  'SGD',
  'THB',
  'VND',
];

export const PRICING_PRESETS: Record<CountryCode, PricingPreset> = {
  PH: {
    countryCode: 'PH',
    countryName: '菲律宾',
    currencyCode: 'PHP',
    totalFeeRate: 0.2524,
    taxMultiplier: 1,
    defaultDiscountRate: 0.45,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 4.5,
    stepPrice: 4.5,
    buyerShipping: 60,
    discountedPriceRule: { mode: 'round', digits: 0 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  MY: {
    countryCode: 'MY',
    countryName: '马来西亚',
    currencyCode: 'MYR',
    totalFeeRate: 0.2498,
    taxMultiplier: 1.1,
    defaultDiscountRate: 0.45,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 0.69,
    stepPrice: 0.15,
    buyerShipping: 6.9,
    discountedPriceRule: { mode: 'none', digits: 2 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  SG: {
    countryCode: 'SG',
    countryName: '新加坡',
    currencyCode: 'SGD',
    totalFeeRate: 0.2081,
    taxMultiplier: 1.09,
    defaultDiscountRate: 0.45,
    startWeightKg: 0.05,
    stepWeightKg: 0.01,
    startPrice: 0.98,
    stepPrice: 0.15,
    buyerShipping: 1.49,
    discountedPriceRule: { mode: 'none', digits: 2 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  TH: {
    countryCode: 'TH',
    countryName: '泰国',
    currencyCode: 'THB',
    totalFeeRate: 0.2266,
    taxMultiplier: 1 + 0.1 + (1 + 0.1) * 0.1556,
    defaultDiscountRate: 0.45,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 2.07,
    stepPrice: 1,
    buyerShipping: 36,
    discountedPriceRule: { mode: 'ceil', digits: 0 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  VN: {
    countryCode: 'VN',
    countryName: '越南',
    currencyCode: 'VND',
    totalFeeRate: 0.26,
    taxMultiplier: 1.1,
    defaultDiscountRate: 0.4,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 13900,
    stepPrice: 900,
    buyerShipping: 23000,
    discountedPriceRule: { mode: 'ceil', digits: -3 },
    preDiscountPriceRule: { mode: 'round', digits: 0 },
  },
};

export function getPricingPreset(countryCode: CountryCode): PricingPreset {
  return PRICING_PRESETS[countryCode];
}

export function applyRoundRule(value: number, rule: RoundRule): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  if (rule.mode === 'none') {
    return value;
  }

  const factor = 10 ** rule.digits;
  if (rule.mode === 'ceil') {
    return Math.ceil(value * factor - 1e-9) / factor;
  }

  return Math.round(value * factor) / factor;
}
