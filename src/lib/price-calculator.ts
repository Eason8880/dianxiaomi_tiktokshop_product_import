import { PriceParams, SourceRow } from '@/types';

/**
 * Calculate the selling price for a single SKU row.
 *
 * Formula:
 * sellingPrice = ((cost + additionalCost + firstMileShipping + lastMileShipping) × profitMultiplier)
 *                / (1 - platformFeeRate) / exchangeRate
 *
 * Where:
 *   firstMileShipping = weightKg × firstMileRate
 *   lastMileShipping = weightKg × lastMileRate
 */
export function calculatePrice(
  row: SourceRow,
  params: PriceParams
): number {
  const cost = Number(row['成本（有差值）']) || 0;
  const weightG = Number(row['发货重量（有差值）']) || Number(row['商品重量(g)']) || 0;
  const weightKg = weightG / 1000;

  const firstMileShipping = weightKg * params.firstMileRate;
  const lastMileShipping = weightKg * params.lastMileRate;

  const baseCost = cost + params.additionalCost + firstMileShipping + lastMileShipping;
  const withProfit = baseCost * params.profitMultiplier;
  const withPlatformFee = withProfit / (1 - params.platformFeeRate);
  const inTargetCurrency = withPlatformFee / params.exchangeRate;

  return Math.round(inTargetCurrency * 100) / 100;
}

/**
 * Get a human-readable breakdown of the price calculation.
 */
export function getPriceBreakdown(
  row: SourceRow,
  params: PriceParams
): {
  cost: number;
  weightG: number;
  firstMile: number;
  lastMile: number;
  baseCost: number;
  withProfit: number;
  withFee: number;
  finalPrice: number;
} {
  const cost = Number(row['成本（有差值）']) || 0;
  const weightG = Number(row['发货重量（有差值）']) || Number(row['商品重量(g)']) || 0;
  const weightKg = weightG / 1000;

  const firstMile = weightKg * params.firstMileRate;
  const lastMile = weightKg * params.lastMileRate;
  const baseCost = cost + params.additionalCost + firstMile + lastMile;
  const withProfit = baseCost * params.profitMultiplier;
  const withFee = withProfit / (1 - params.platformFeeRate);
  const finalPrice = Math.round((withFee / params.exchangeRate) * 100) / 100;

  return { cost, weightG, firstMile, lastMile, baseCost, withProfit, withFee, finalPrice };
}
