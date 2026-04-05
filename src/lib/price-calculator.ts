import { ExchangeRateCode, ExchangeRatesState, PriceParams, SourceRow } from '@/types';
import {
  applyRoundRule,
  EuropePricingPreset,
  findEuropeCategory,
  findMexicoShippingTier,
  getPricingPreset,
  MexicoPricingPreset,
  PACKAGE_HANDLING_FEE_CNY,
  SeaPricingPreset,
} from '@/lib/pricing-config';

export interface PriceBreakdown {
  costCny: number;
  weightG: number;
  weightKg: number;
  packageFeeCny: number;
  usdToCny: number;
  usdToLocal: number;
  crossBorderShippingLocal: number;
  discountedLocalPrice: number;
  preDiscountLocalPrice: number;
  currencyCode: string;
  pricingProfitRate: number;
  discountRate: number;
}

function parsePositiveNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSourceCostCny(row: SourceRow): number | null {
  return parsePositiveNumber(row['成本（有差值）']);
}

function getSourceWeightG(row: SourceRow): number | null {
  return (
    parsePositiveNumber(row['发货重量（有差值）']) ??
    parsePositiveNumber(row['商品重量(g)'])
  );
}

function getShippingSteps(weightKg: number, startWeightKg: number, stepWeightKg: number): number {
  if (weightKg <= startWeightKg) {
    return 0;
  }

  return Math.max(Math.ceil((weightKg - startWeightKg) / stepWeightKg - 1e-9), 0);
}

interface CostContext {
  costCny: number;
  weightG: number;
  weightKg: number;
  usdToCny: number;
  usdToLocal: number;
  costLocal: number;
}

function buildCostContext(
  row: SourceRow,
  preset: { currencyCode: ExchangeRateCode },
  exchangeRates: ExchangeRatesState
): CostContext | null {
  const costCny = getSourceCostCny(row);
  const weightG = getSourceWeightG(row);
  const usdToCny = exchangeRates.rates.CNY;
  const usdToLocal = exchangeRates.rates[preset.currencyCode];

  if (!costCny || !weightG || !usdToCny || !usdToLocal) {
    return null;
  }

  const weightKg = weightG / 1000;
  const costUsd = (costCny + PACKAGE_HANDLING_FEE_CNY) / usdToCny;
  const costLocal = costUsd * usdToLocal;

  return { costCny, weightG, weightKg, usdToCny, usdToLocal, costLocal };
}

// --- SEA (PH/MY/SG/TH/VN): stepped shipping + flat tax multiplier ---
function getSeaBreakdown(
  row: SourceRow,
  params: PriceParams,
  preset: SeaPricingPreset,
  exchangeRates: ExchangeRatesState
): PriceBreakdown | null {
  const ctx = buildCostContext(row, preset, exchangeRates);
  if (!ctx) {
    return null;
  }

  const shippingSteps = getShippingSteps(ctx.weightKg, preset.startWeightKg, preset.stepWeightKg);
  const crossBorderShippingLocal = preset.startPrice + shippingSteps * preset.stepPrice;
  const denominator = 1 - params.pricingProfitRate - preset.totalFeeRate;
  if (denominator <= 0) {
    return null;
  }

  const baseAfterFees = (ctx.costLocal + crossBorderShippingLocal) / denominator;
  const discountedLocalPrice = applyRoundRule(
    baseAfterFees * preset.taxMultiplier,
    preset.discountedPriceRule
  );

  const discountDenominator = 1 - params.discountRate;
  if (discountDenominator <= 0) {
    return null;
  }

  const preDiscountLocalPrice = applyRoundRule(
    discountedLocalPrice / discountDenominator,
    preset.preDiscountPriceRule
  );

  return {
    costCny: ctx.costCny,
    weightG: ctx.weightG,
    weightKg: ctx.weightKg,
    packageFeeCny: PACKAGE_HANDLING_FEE_CNY,
    usdToCny: ctx.usdToCny,
    usdToLocal: ctx.usdToLocal,
    crossBorderShippingLocal,
    discountedLocalPrice,
    preDiscountLocalPrice,
    currencyCode: preset.currencyCode,
    pricingProfitRate: params.pricingProfitRate,
    discountRate: params.discountRate,
  };
}

// --- Europe (FR/DE/IT/ES/GB): continuous per-kg shipping + VAT back-calc ---
// Matches the reference Excel sheet `参数`/`计算`:
//   preTax     = (costLocal + shippingLocal) / (1 - profit - commission)
//   vat        = (preTax + customerShipping) * vatRate / (1 + vatRate)
//   discounted = round(preTax + vat, 2)
// For UK: if the *unrounded* (preTax + vat) crosses ukThresholdLocal, add
// ukThresholdSurcharge before rounding.
function getEuropeBreakdown(
  row: SourceRow,
  params: PriceParams,
  preset: EuropePricingPreset,
  exchangeRates: ExchangeRatesState
): PriceBreakdown | null {
  const ctx = buildCostContext(row, preset, exchangeRates);
  if (!ctx) {
    return null;
  }

  const tier = preset.categories[findEuropeCategory(row)];
  const extraKg = Math.max(ctx.weightKg - preset.startWeightKg, 0);
  const crossBorderShippingLocal = tier.startPrice + extraKg * tier.stepPricePerKg;

  const denominator = 1 - params.pricingProfitRate - preset.commissionRate;
  if (denominator <= 0) {
    return null;
  }

  const preTax = (ctx.costLocal + crossBorderShippingLocal) / denominator;
  const vat = ((preTax + preset.customerShipping) * tier.vatRate) / (1 + tier.vatRate);
  let rawDiscounted = preTax + vat;

  // UK £35 threshold: compare against unrounded value (matches Excel formula).
  if (
    typeof preset.ukThresholdLocal === 'number' &&
    typeof preset.ukThresholdSurcharge === 'number' &&
    rawDiscounted >= preset.ukThresholdLocal
  ) {
    rawDiscounted += preset.ukThresholdSurcharge;
  }

  const discountedLocalPrice = applyRoundRule(rawDiscounted, preset.discountedPriceRule);

  const discountDenominator = 1 - params.discountRate;
  if (discountDenominator <= 0) {
    return null;
  }

  const preDiscountLocalPrice = applyRoundRule(
    discountedLocalPrice / discountDenominator,
    preset.preDiscountPriceRule
  );

  return {
    costCny: ctx.costCny,
    weightG: ctx.weightG,
    weightKg: ctx.weightKg,
    packageFeeCny: PACKAGE_HANDLING_FEE_CNY,
    usdToCny: ctx.usdToCny,
    usdToLocal: ctx.usdToLocal,
    crossBorderShippingLocal,
    discountedLocalPrice,
    preDiscountLocalPrice,
    currencyCode: preset.currencyCode,
    pricingProfitRate: params.pricingProfitRate,
    discountRate: params.discountRate,
  };
}

// --- Mexico (MX): tiered shipping + SFP subsidy + import tax floor ---
// Matches the reference Excel sheet `新版-计算表格`:
//   shipping   = max(weightKg * shipPerKg + basicFee - sfpSubsidy, 0)
//   preTax     = (costLocal + shipping) / (1 - platformFees - profit)
//   importTax  = max((preTax * (1+r) + sfpSubsidy - thresholdUsd*fx) / (1+r) * r, minImportTax)
//   discounted = round(preTax + importTax, 2)
function getMexicoBreakdown(
  row: SourceRow,
  params: PriceParams,
  preset: MexicoPricingPreset,
  exchangeRates: ExchangeRatesState
): PriceBreakdown | null {
  const ctx = buildCostContext(row, preset, exchangeRates);
  if (!ctx) {
    return null;
  }

  const tier = findMexicoShippingTier(preset.shippingTiers, ctx.weightKg);
  if (!tier) {
    return null;
  }

  const rawShipping = ctx.weightKg * tier.shipPerKg + tier.basicFee - preset.sfpSubsidyLocal;
  const crossBorderShippingLocal = Math.max(rawShipping, 0);

  const denominator = 1 - preset.platformFeeRate - params.pricingProfitRate;
  if (denominator <= 0) {
    return null;
  }

  const preTax = (ctx.costLocal + crossBorderShippingLocal) / denominator;

  const r = preset.importTaxRate;
  const thresholdLocal = preset.importTaxFreeThresholdUsd * ctx.usdToLocal;
  const rawImportTax = ((preTax * (1 + r) + preset.sfpSubsidyLocal - thresholdLocal) / (1 + r)) * r;
  const importTax = Math.max(rawImportTax, preset.minImportTaxLocal);

  const discountedLocalPrice = applyRoundRule(preTax + importTax, preset.discountedPriceRule);

  const discountDenominator = 1 - params.discountRate;
  if (discountDenominator <= 0) {
    return null;
  }

  const preDiscountLocalPrice = applyRoundRule(
    discountedLocalPrice / discountDenominator,
    preset.preDiscountPriceRule
  );

  return {
    costCny: ctx.costCny,
    weightG: ctx.weightG,
    weightKg: ctx.weightKg,
    packageFeeCny: PACKAGE_HANDLING_FEE_CNY,
    usdToCny: ctx.usdToCny,
    usdToLocal: ctx.usdToLocal,
    crossBorderShippingLocal,
    discountedLocalPrice,
    preDiscountLocalPrice,
    currencyCode: preset.currencyCode,
    pricingProfitRate: params.pricingProfitRate,
    discountRate: params.discountRate,
  };
}

export function getPriceBreakdown(
  row: SourceRow,
  params: PriceParams,
  exchangeRates: ExchangeRatesState | null
): PriceBreakdown | null {
  if (!exchangeRates) {
    return null;
  }

  const preset = getPricingPreset(params.countryCode);

  switch (preset.mode) {
    case 'sea':
      return getSeaBreakdown(row, params, preset, exchangeRates);
    case 'europe':
      return getEuropeBreakdown(row, params, preset, exchangeRates);
    case 'mexico':
      return getMexicoBreakdown(row, params, preset, exchangeRates);
    default: {
      // Exhaustiveness: adding a new mode must be handled above.
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function calculatePrice(
  row: SourceRow,
  params: PriceParams,
  exchangeRates: ExchangeRatesState | null
): number | '' {
  return getPriceBreakdown(row, params, exchangeRates)?.preDiscountLocalPrice ?? '';
}
