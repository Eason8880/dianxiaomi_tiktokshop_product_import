'use client';

import { ExchangeRatesState, PriceParams, SourceRow, CountryCode } from '@/types';
import { getPriceBreakdown } from '@/lib/price-calculator';
import {
  COUNTRY_OPTIONS,
  getPricingPreset,
  PACKAGE_HANDLING_FEE_CNY,
} from '@/lib/pricing-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { getZebraTableToneClass } from '@/lib/table-contrast';

interface PriceCalculatorProps {
  params: PriceParams;
  sampleRows: SourceRow[];
  exchangeRates: ExchangeRatesState | null;
  exchangeRatesLoading: boolean;
  exchangeRatesError: string | null;
  onChange: (params: PriceParams) => void;
  onRefreshExchangeRates: () => void;
}

function formatFixedNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return value.toFixed(digits);
}

function formatFlexibleNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

function formatPercentValue(rate: number | null | undefined, digits = 2): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return '—';
  }

  const percentage = rate * 100;
  const fixed = percentage.toFixed(digits);
  return fixed.replace(/\.?0+$/, '');
}

function getCurrencyDateEntries(exchangeRates: ExchangeRatesState) {
  return [
    { label: 'USD/CNY', date: exchangeRates.rateDates.CNY },
    { label: 'USD/PHP', date: exchangeRates.rateDates.PHP },
    { label: 'USD/MYR', date: exchangeRates.rateDates.MYR },
    { label: 'USD/SGD', date: exchangeRates.rateDates.SGD },
    { label: 'USD/THB', date: exchangeRates.rateDates.THB },
    { label: 'USD/VND', date: exchangeRates.rateDates.VND },
  ];
}

export function PriceCalculator({
  params,
  sampleRows,
  exchangeRates,
  exchangeRatesLoading,
  exchangeRatesError,
  onChange,
  onRefreshExchangeRates,
}: PriceCalculatorProps) {
  const preset = getPricingPreset(params.countryCode);
  const selectedCountry = COUNTRY_OPTIONS.find((option) => option.value === params.countryCode);

  function updatePercentField(key: 'pricingProfitRate' | 'discountRate', value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onChange({ ...params, [key]: num / 100 });
    }
  }

  function getPercentDisplayValue(rate: number): string {
    return formatPercentValue(rate);
  }

  function updateCountry(countryCode: CountryCode | null) {
    if (!countryCode) {
      return;
    }

    const nextCountry = countryCode;
    const nextPreset = getPricingPreset(nextCountry);
    onChange({
      countryCode: nextCountry,
      pricingProfitRate: params.pricingProfitRate,
      discountRate: nextPreset.defaultDiscountRate,
    });
  }

  const previewRows = sampleRows.slice(0, 8);

  return (
    <div className="space-y-6">
      <Card className="bg-primary/8 border border-primary/20">
        <CardContent className="py-4">
          <p className="text-sm text-primary/90 font-mono">
            成本(站点币种) = ((成本 + 0.8元处理费) / USD/CNY) × USD/{preset.currencyCode}
          </p>
          <p className="text-sm text-primary/90 font-mono mt-1">
            折后售价 = ((成本(站点币种) + 跨境物流) / (1 - 定价利润率 - 国家综合费率)) × 税费系数
          </p>
          <p className="text-sm text-primary/90 font-mono mt-1">
            导出折前售价 = 折后售价 / (1 - 折扣)
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">站点国家</Label>
          <Select value={params.countryCode} onValueChange={updateCountry}>
            <SelectTrigger className="w-full h-9">
              <span className="flex-1 truncate text-left">
                {selectedCountry ? `${selectedCountry.label} (${selectedCountry.value})` : '选择站点国家'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">切换国家后会恢复该站点默认折扣</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">定价利润率</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="99"
              value={getPercentDisplayValue(params.pricingProfitRate)}
              onChange={(e) => updatePercentField('pricingProfitRate', e.target.value)}
              className="pr-10"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">例如 28 表示 28% 定价利润率</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">折扣</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="99"
              value={getPercentDisplayValue(params.discountRate)}
              onChange={(e) => updatePercentField('discountRate', e.target.value)}
              className="pr-10"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">例如 45 表示 45% 折扣，最终导出折前售价</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">汇率与国家规则</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              当前站点：<span className="text-foreground font-medium">{preset.countryName}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshExchangeRates}
              disabled={exchangeRatesLoading}
            >
              {exchangeRatesLoading ? '刷新中…' : '刷新汇率'}
            </Button>
          </div>

          {exchangeRatesError && !exchangeRates && (
            <Alert variant="destructive">
              <AlertDescription>{exchangeRatesError}</AlertDescription>
            </Alert>
          )}

          {exchangeRates && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-muted-foreground">USD/CNY</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatFixedNumber(exchangeRates.rates.CNY, 4)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-muted-foreground">USD/{preset.currencyCode}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatFixedNumber(exchangeRates.rates[preset.currencyCode], 4)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-muted-foreground">最新汇率日</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{exchangeRates.providerDate}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-muted-foreground">状态</p>
                  <p className={`mt-1 text-lg font-semibold ${exchangeRates.isStale ? 'text-[oklch(0.75_0.15_80)]' : 'text-foreground'}`}>
                    {exchangeRates.isStale ? '缓存值' : '最新值'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs text-muted-foreground">
                <div>包裹处理费：{PACKAGE_HANDLING_FEE_CNY.toFixed(1)} CNY</div>
                <div>综合费率：{formatPercentValue(preset.totalFeeRate)}%（含5%达人佣金）</div>
                <div>税费系数：{preset.taxMultiplier.toFixed(4)}</div>
                <div>
                  物流规则：{preset.startWeightKg.toFixed(2)}kg 起 {preset.startPrice} {preset.currencyCode}，
                  每 {preset.stepWeightKg.toFixed(2)}kg 续 {preset.stepPrice}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">各币种汇率日期</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
                  {getCurrencyDateEntries(exchangeRates).map((entry) => (
                    <div
                      key={entry.label}
                      className="rounded-md border border-border/50 bg-background/60 px-3 py-2"
                    >
                      <p className="text-muted-foreground">{entry.label}</p>
                      <p className="mt-1 font-medium text-foreground">{entry.date}</p>
                    </div>
                  ))}
                </div>
              </div>

              {exchangeRates.isStale && (
                <Alert>
                  <AlertDescription>
                    当前展示的是最近一次成功获取的缓存汇率。抓取时间：{exchangeRates.fetchedAt}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {previewRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">价格预览（前 {previewRows.length} 条）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">成本(¥)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">重量(g)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">处理费(¥)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">跨境物流({preset.currencyCode})</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">折后售价({preset.currencyCode})</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">折扣</th>
                    <th className="px-3 py-2 text-right font-medium text-primary">导出折前售价({preset.currencyCode})</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const b = getPriceBreakdown(row, params, exchangeRates);
                    return (
                      <tr key={i} className={`border-b last:border-0 border-border transition-colors ${getZebraTableToneClass(i)}`}>
                        <td className="px-3 py-2 text-foreground">{String(row['Seller SKU'] || `#${i + 1}`)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatFlexibleNumber(b?.costCny)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{typeof b?.weightG === 'number' ? b.weightG : '—'}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatFlexibleNumber(b?.packageFeeCny)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatFlexibleNumber(b?.crossBorderShippingLocal)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatFlexibleNumber(b?.discountedLocalPrice)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {typeof b?.discountRate === 'number' ? `${formatPercentValue(b.discountRate)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{formatFlexibleNumber(b?.preDiscountLocalPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
