import { ExchangeRatesState, PriceParams, SourceRow } from '@/types';
import {
  applyRoundRule,
  getPricingPreset,
  PACKAGE_HANDLING_FEE_CNY,
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

export function getPriceBreakdown(
  row: SourceRow,
  params: PriceParams,
  exchangeRates: ExchangeRatesState | null
): PriceBreakdown | null {
  if (!exchangeRates) {
    return null;
  }

  const preset = getPricingPreset(params.countryCode);
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
  const shippingSteps = getShippingSteps(weightKg, preset.startWeightKg, preset.stepWeightKg);
  const crossBorderShippingLocal = preset.startPrice + shippingSteps * preset.stepPrice;
  const denominator = 1 - params.pricingProfitRate - preset.totalFeeRate;
  if (denominator <= 0) {
    return null;
  }

  const baseAfterFees = (costLocal + crossBorderShippingLocal) / denominator;
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
    costCny,
    weightG,
    weightKg,
    packageFeeCny: PACKAGE_HANDLING_FEE_CNY,
    usdToCny,
    usdToLocal,
    crossBorderShippingLocal,
    discountedLocalPrice,
    preDiscountLocalPrice,
    currencyCode: preset.currencyCode,
    pricingProfitRate: params.pricingProfitRate,
    discountRate: params.discountRate,
  };
}

export function calculatePrice(
  row: SourceRow,
  params: PriceParams,
  exchangeRates: ExchangeRatesState | null
): number | '' {
  return getPriceBreakdown(row, params, exchangeRates)?.preDiscountLocalPrice ?? '';
}
