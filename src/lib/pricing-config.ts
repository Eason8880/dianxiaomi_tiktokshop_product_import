import { CountryCode, ExchangeRateCode, ProductForm, SourceRow } from '@/types';

export const PACKAGE_HANDLING_FEE_CNY = 0.8;
export const DEFAULT_DISCOUNT_RATE = 0.45;

export interface RoundRule {
  mode: 'round' | 'ceil' | 'none';
  digits: number;
}

// --- Discriminated union for pricing presets ---
// The three modes differ structurally (SEA has stepped shipping + flat tax
// multiplier; EU has continuous per-kg shipping + VAT back-calc; MX has tiered
// shipping + import tax floor + SFP subsidy), so we key on `mode` and narrow
// per branch inside the price calculator dispatcher.

interface BasePricingPreset {
  countryCode: CountryCode;
  countryName: string;
  currencyCode: ExchangeRateCode;
  discountedPriceRule: RoundRule;
  preDiscountPriceRule: RoundRule;
}

export interface SeaPricingPreset extends BasePricingPreset {
  mode: 'sea';
  totalFeeRate: number;
  taxMultiplier: number;
  startWeightKg: number;
  stepWeightKg: number;
  startPrice: number;
  stepPrice: number;
  buyerShipping: number;
}

export interface EuropeCategoryRates {
  startPrice: number; // local currency, applies at or below startWeightKg
  stepPricePerKg: number; // local currency per kg, continuous after startWeightKg
  vatRate: number; // e.g. 0.2 for 20%
}

export interface EuropePricingPreset extends BasePricingPreset {
  mode: 'europe';
  // Commission rate feeding the pre-VAT denominator: platform + KOL commission.
  commissionRate: number;
  // Customer-side shipping constant used only inside the VAT back-calc formula.
  customerShipping: number;
  // Shipping start weight in kg (0.05 for all EU/UK presets).
  startWeightKg: number;
  // Per-category shipping tiers and VAT. 产品形态 in source row selects the key.
  categories: Record<ProductForm, EuropeCategoryRates>;
  // UK-only: if unrounded discounted price >= threshold, add surcharge.
  ukThresholdLocal?: number;
  ukThresholdSurcharge?: number;
}

export interface MexicoShippingTier {
  minKg: number;
  maxKg: number;
  shipPerKg: number;
  basicFee: number;
}

export interface MexicoPricingPreset extends BasePricingPreset {
  mode: 'mexico';
  // Sum of platform fee + SFP + e-commerce tax + KOL + ads (feeds denominator).
  platformFeeRate: number;
  importTaxRate: number;
  importTaxFreeThresholdUsd: number;
  minImportTaxLocal: number;
  sfpSubsidyLocal: number;
  shippingTiers: MexicoShippingTier[];
}

export type PricingPreset = SeaPricingPreset | EuropePricingPreset | MexicoPricingPreset;

// Display order: SEA first, then Europe/UK, then Mexico.
export const COUNTRY_OPTIONS: Array<{ value: CountryCode; label: string }> = [
  { value: 'PH', label: '菲律宾' },
  { value: 'MY', label: '马来西亚' },
  { value: 'SG', label: '新加坡' },
  { value: 'TH', label: '泰国' },
  { value: 'VN', label: '越南' },
  { value: 'GB', label: '英国' },
  { value: 'DE', label: '德国' },
  { value: 'FR', label: '法国' },
  { value: 'IT', label: '意大利' },
  { value: 'ES', label: '西班牙' },
  { value: 'MX', label: '墨西哥' },
];

export const REQUIRED_EXCHANGE_RATE_CODES: ExchangeRateCode[] = [
  'CNY',
  'PHP',
  'MYR',
  'SGD',
  'THB',
  'VND',
  'EUR',
  'GBP',
  'MXN',
];

// Per-country default pricing parameters. Country switch resets both profit
// rate and discount to these values. Single source of truth for defaults.
export const DEFAULT_PARAMS_BY_COUNTRY: Record<
  CountryCode,
  { pricingProfitRate: number; discountRate: number }
> = {
  PH: { pricingProfitRate: 0.28, discountRate: DEFAULT_DISCOUNT_RATE },
  MY: { pricingProfitRate: 0.28, discountRate: DEFAULT_DISCOUNT_RATE },
  SG: { pricingProfitRate: 0.28, discountRate: DEFAULT_DISCOUNT_RATE },
  TH: { pricingProfitRate: 0.28, discountRate: DEFAULT_DISCOUNT_RATE },
  VN: { pricingProfitRate: 0.28, discountRate: DEFAULT_DISCOUNT_RATE },
  GB: { pricingProfitRate: 0.35, discountRate: 0.42 },
  DE: { pricingProfitRate: 0.35, discountRate: 0.42 },
  FR: { pricingProfitRate: 0.35, discountRate: 0.42 },
  IT: { pricingProfitRate: 0.35, discountRate: 0.42 },
  ES: { pricingProfitRate: 0.35, discountRate: 0.42 },
  MX: { pricingProfitRate: 0.25, discountRate: 0.4 },
};

// Reusable round rules for EU/UK/MX (all 2 decimal places — matches Excel ROUND).
const EU_ROUND_2: RoundRule = { mode: 'round', digits: 2 };

// Customer-side shipping constants (EU/UK, used only in VAT formula).
const EU_CUSTOMER_SHIPPING = 3.99;
const EU_START_WEIGHT_KG = 0.05;

export const PRICING_PRESETS: Record<CountryCode, PricingPreset> = {
  PH: {
    mode: 'sea',
    countryCode: 'PH',
    countryName: '菲律宾',
    currencyCode: 'PHP',
    totalFeeRate: 0.2524,
    taxMultiplier: 1,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 4.5,
    stepPrice: 4.5,
    buyerShipping: 60,
    discountedPriceRule: { mode: 'round', digits: 0 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  MY: {
    mode: 'sea',
    countryCode: 'MY',
    countryName: '马来西亚',
    currencyCode: 'MYR',
    totalFeeRate: 0.2498,
    taxMultiplier: 1.1,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 0.69,
    stepPrice: 0.15,
    buyerShipping: 6.9,
    discountedPriceRule: { mode: 'none', digits: 2 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  SG: {
    mode: 'sea',
    countryCode: 'SG',
    countryName: '新加坡',
    currencyCode: 'SGD',
    totalFeeRate: 0.2081,
    taxMultiplier: 1.09,
    startWeightKg: 0.05,
    stepWeightKg: 0.01,
    startPrice: 0.98,
    stepPrice: 0.15,
    buyerShipping: 1.49,
    discountedPriceRule: { mode: 'none', digits: 2 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  TH: {
    mode: 'sea',
    countryCode: 'TH',
    countryName: '泰国',
    currencyCode: 'THB',
    totalFeeRate: 0.2266,
    taxMultiplier: 1 + 0.1 + (1 + 0.1) * 0.1556,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 2.07,
    stepPrice: 1,
    buyerShipping: 36,
    discountedPriceRule: { mode: 'ceil', digits: 0 },
    preDiscountPriceRule: { mode: 'round', digits: 2 },
  },
  VN: {
    mode: 'sea',
    countryCode: 'VN',
    countryName: '越南',
    currencyCode: 'VND',
    totalFeeRate: 0.26,
    taxMultiplier: 1.1,
    startWeightKg: 0.01,
    stepWeightKg: 0.01,
    startPrice: 13900,
    stepPrice: 900,
    buyerShipping: 23000,
    discountedPriceRule: { mode: 'ceil', digits: -3 },
    preDiscountPriceRule: { mode: 'round', digits: 0 },
  },
  // --- Europe (EU/UK) ---
  // Shipping: startPrice at ≤ 0.05 kg, then continuous (weightKg - 0.05) * stepPricePerKg.
  // Commission rate: platform + KOL (fed to denominator with pricingProfitRate).
  // VAT is back-calculated from the tax-inclusive discounted price.
  GB: {
    mode: 'europe',
    countryCode: 'GB',
    countryName: '英国',
    currencyCode: 'GBP',
    commissionRate: 0.19, // 9% platform + 10% KOL
    customerShipping: EU_CUSTOMER_SHIPPING,
    startWeightKg: EU_START_WEIGHT_KG,
    categories: {
      普货: { startPrice: 0.255, stepPricePerKg: 5.1, vatRate: 0.2 },
      特货: { startPrice: 0.2955, stepPricePerKg: 5.91, vatRate: 0.2 },
      敏货: { startPrice: 0.2955, stepPricePerKg: 5.91, vatRate: 0.2 },
    },
    // UK-only surcharge on the unrounded discounted price.
    ukThresholdLocal: 35,
    ukThresholdSurcharge: 3.99,
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
  DE: {
    mode: 'europe',
    countryCode: 'DE',
    countryName: '德国',
    currencyCode: 'EUR',
    commissionRate: 0.25, // 15% platform + 10% KOL
    customerShipping: EU_CUSTOMER_SHIPPING,
    startWeightKg: EU_START_WEIGHT_KG,
    categories: {
      普货: { startPrice: 0.42, stepPricePerKg: 8.4, vatRate: 0.19 },
      特货: { startPrice: 0.42, stepPricePerKg: 8.4, vatRate: 0.19 },
      敏货: { startPrice: 0.425, stepPricePerKg: 8.5, vatRate: 0.19 },
    },
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
  FR: {
    mode: 'europe',
    countryCode: 'FR',
    countryName: '法国',
    currencyCode: 'EUR',
    commissionRate: 0.25,
    customerShipping: EU_CUSTOMER_SHIPPING,
    startWeightKg: EU_START_WEIGHT_KG,
    categories: {
      普货: { startPrice: 0.38, stepPricePerKg: 7.6, vatRate: 0.2 },
      特货: { startPrice: 0.4, stepPricePerKg: 8.0, vatRate: 0.2 },
      敏货: { startPrice: 0.405, stepPricePerKg: 8.1, vatRate: 0.2 },
    },
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
  IT: {
    mode: 'europe',
    countryCode: 'IT',
    countryName: '意大利',
    currencyCode: 'EUR',
    commissionRate: 0.25,
    customerShipping: EU_CUSTOMER_SHIPPING,
    startWeightKg: EU_START_WEIGHT_KG,
    categories: {
      普货: { startPrice: 0.385, stepPricePerKg: 7.7, vatRate: 0.22 },
      特货: { startPrice: 0.435, stepPricePerKg: 8.7, vatRate: 0.22 },
      敏货: { startPrice: 0.435, stepPricePerKg: 8.7, vatRate: 0.22 },
    },
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
  ES: {
    mode: 'europe',
    countryCode: 'ES',
    countryName: '西班牙',
    currencyCode: 'EUR',
    commissionRate: 0.25,
    customerShipping: EU_CUSTOMER_SHIPPING,
    startWeightKg: EU_START_WEIGHT_KG,
    categories: {
      普货: { startPrice: 0.34, stepPricePerKg: 6.8, vatRate: 0.21 },
      特货: { startPrice: 0.37, stepPricePerKg: 7.4, vatRate: 0.21 },
      敏货: { startPrice: 0.37, stepPricePerKg: 7.4, vatRate: 0.21 },
    },
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
  // --- Mexico (MX) ---
  // Platform fees sum: 6% platform + 8% SFP + 5% e-com tax + 5% KOL + 5% ads.
  // Import tax: 33.5% on CIF-like base with 4.5 USD tax-free threshold, floor 6 MXN.
  // SFP subsidy: 59 MXN deducted from raw shipping (floor 0).
  MX: {
    mode: 'mexico',
    countryCode: 'MX',
    countryName: '墨西哥',
    currencyCode: 'MXN',
    platformFeeRate: 0.29,
    importTaxRate: 0.335,
    importTaxFreeThresholdUsd: 4.5,
    minImportTaxLocal: 6,
    sfpSubsidyLocal: 59,
    shippingTiers: [
      { minKg: 0, maxKg: 1.0, shipPerKg: 166.608, basicFee: 49.18 },
      { minKg: 1.001, maxKg: 2.0, shipPerKg: 166.608, basicFee: 72.0 },
      { minKg: 2.001, maxKg: 5.0, shipPerKg: 166.608, basicFee: 76.35 },
      { minKg: 5.001, maxKg: 30.0, shipPerKg: 166.608, basicFee: 199.08 },
    ],
    discountedPriceRule: EU_ROUND_2,
    preDiscountPriceRule: EU_ROUND_2,
  },
};

export function getPricingPreset(countryCode: CountryCode): PricingPreset {
  return PRICING_PRESETS[countryCode];
}

// Read the goods category tier (产品形态) from a source row, defaulting to 普货.
// The column is optional; when missing or unrecognized, fall back to 普货.
export function findEuropeCategory(row: SourceRow): ProductForm {
  const raw = row['产品形态'];
  if (typeof raw !== 'string') {
    return '普货';
  }
  const trimmed = raw.trim();
  if (trimmed === '普货' || trimmed === '特货' || trimmed === '敏货') {
    return trimmed;
  }
  return '普货';
}

let mexicoWeightClampWarned = false;

// Look up the Mexico shipping tier for a given weight. Weight above 30 kg is
// clamped to the last tier (matches the Excel's tolerance for out-of-range
// rows); emits a one-time console.warn per session so the operator knows.
export function findMexicoShippingTier(
  tiers: MexicoShippingTier[],
  weightKg: number
): MexicoShippingTier | null {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return null;
  }
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    return null;
  }

  for (const tier of tiers) {
    if (weightKg >= tier.minKg && weightKg <= tier.maxKg) {
      return tier;
    }
  }

  // Above the last tier max — clamp and warn once.
  const last = tiers[tiers.length - 1];
  if (weightKg > last.maxKg) {
    if (!mexicoWeightClampWarned) {
      mexicoWeightClampWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[pricing] 墨西哥物流重量 ${weightKg.toFixed(3)}kg 超出 ${last.maxKg}kg 上限，按最后一档计算`
      );
    }
    return last;
  }

  return null;
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
