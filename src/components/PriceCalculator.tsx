'use client';

import { PriceParams, SourceRow } from '@/types';
import { calculatePrice, getPriceBreakdown } from '@/lib/price-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PriceCalculatorProps {
  params: PriceParams;
  sampleRows: SourceRow[];
  onChange: (params: PriceParams) => void;
}

export function PriceCalculator({ params, sampleRows, onChange }: PriceCalculatorProps) {
  function update(key: keyof PriceParams, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onChange({ ...params, [key]: num });
    }
  }

  const previewRows = sampleRows.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Formula display */}
      <Card className="bg-primary/8 border border-primary/20">
        <CardContent className="py-4">
          <p className="text-sm text-primary/90 font-mono">
            售价 = ((成本 + 附加费用 + 重量kg × 头程运费/kg + 重量kg × 尾程运费/kg) × 利润倍率)
          </p>
          <p className="text-sm text-primary/90 font-mono mt-1 ml-8">
            / (1 - 平台费率) / 汇率
          </p>
        </CardContent>
      </Card>

      {/* Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">汇率（人民币/目标货币）</Label>
          <Input
            type="number" step="0.01" min="0.01"
            value={params.exchangeRate}
            onChange={(e) => update('exchangeRate', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">例如 USD: 7.2，GBP: 9.1</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">头程运费（元/kg）</Label>
          <Input
            type="number" step="0.1" min="0"
            value={params.firstMileRate}
            onChange={(e) => update('firstMileRate', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">国内到仓库</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">尾程运费（元/kg）</Label>
          <Input
            type="number" step="0.1" min="0"
            value={params.lastMileRate}
            onChange={(e) => update('lastMileRate', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">海外配送到买家</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">利润倍率</Label>
          <Input
            type="number" step="0.1" min="1"
            value={params.profitMultiplier}
            onChange={(e) => update('profitMultiplier', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">例如 2.0 = 100% 加价</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">平台费率</Label>
          <Input
            type="number" step="0.01" min="0" max="1"
            value={params.platformFeeRate}
            onChange={(e) => update('platformFeeRate', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">例如 0.08 = 8%</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">附加费用（元/件）</Label>
          <Input
            type="number" step="0.1" min="0"
            value={params.additionalCost}
            onChange={(e) => update('additionalCost', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">包装、标签等固定成本</p>
        </div>
      </div>

      {/* Price preview */}
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
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">头程(¥)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">尾程(¥)</th>
                    <th className="px-3 py-2 text-right font-medium text-primary">售价</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const b = getPriceBreakdown(row, params);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-foreground">{String(row['Seller SKU'] || `#${i + 1}`)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{b.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{b.weightG}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{b.firstMile.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{b.lastMile.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{b.finalPrice.toFixed(2)}</td>
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
