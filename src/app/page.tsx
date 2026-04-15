'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SourceRow,
  ColumnMapping,
  PriceParams,
  ProductGroup,
  TargetRow,
  ExchangeRatesState,
  TemplateType,
} from '@/types';
import { DEFAULT_MAPPINGS, DEFAULT_PRICE_PARAMS, STORE_BACKEND_DEFAULT_MAPPINGS, TARGET_COLUMNS, STORE_BACKEND_TARGET_COLUMNS } from '@/lib/constants';
import { groupByProduct } from '@/lib/product-grouper';
import { applyMappings } from '@/lib/column-mapping';
import { getPricingPreset } from '@/lib/pricing-config';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { ColumnMappingEditor } from '@/components/ColumnMapping';
import { PriceCalculator } from '@/components/PriceCalculator';
import { VariantAnalysis } from '@/components/VariantAnalysis';
import { CategoryConfig } from '@/components/CategoryConfig';
import { ExportPreview } from '@/components/ExportPreview';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  { id: 1, title: '上传数据', desc: '上传 ERP 导出的商品表格' },
  { id: 2, title: '列映射', desc: '配置字段对应关系' },
  { id: 3, title: '变种分析', desc: 'AI 分析变种维度结构' },
  { id: 4, title: '定价设置', desc: '配置售价计算公式' },
  { id: 5, title: '推荐类目', desc: '获取 TikTok 上架分类' },
  { id: 6, title: '导出', desc: '预览并下载上架表格' },
];

async function fetchExchangeRates(forceRefresh = false): Promise<ExchangeRatesState> {
  const query = forceRefresh ? '?refresh=1' : '';
  const response = await fetch(`/api/exchange-rates${query}`, {
    cache: 'no-store',
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data as ExchangeRatesState;
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [templateType, setTemplateType] = useState<TemplateType>('dianxiaomi');
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>(DEFAULT_MAPPINGS);
  const [priceParams, setPriceParams] = useState<PriceParams>(DEFAULT_PRICE_PARAMS);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [warehouseName, setWarehouseName] = useState('');
  const [defaultBrand, setDefaultBrand] = useState('无品牌');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesState | null>(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
  const [exchangeRatesError, setExchangeRatesError] = useState<string | null>(null);

  function handleDataParsed(headers: string[], rows: SourceRow[]) {
    setSourceHeaders(headers);
    setSourceRows(rows);
    const groups = groupByProduct(rows);
    setProductGroups(groups);
  }

  function handleBrandChange(brand: string) {
    setDefaultBrand(brand);
    setMappings((prev) =>
      prev.map((m) => (m.targetColumn === '品牌' ? { ...m, fixedValue: brand } : m))
    );
  }

  function handleTemplateChange(next: TemplateType) {
    setTemplateType(next);
    // Reset mappings to defaults for the selected template, preserving brand
    const base = next === 'store' ? STORE_BACKEND_DEFAULT_MAPPINGS : DEFAULT_MAPPINGS;
    setMappings(base.map((m) => (m.targetColumn === '品牌' ? { ...m, fixedValue: defaultBrand } : m)));
  }

  useEffect(() => {
    let active = true;

    async function loadRates() {
      setExchangeRatesLoading(true);
      setExchangeRatesError(null);

      try {
        const nextRates = await fetchExchangeRates();
        if (!active) return;
        setExchangeRates(nextRates);
      } catch (error) {
        if (!active) return;
        setExchangeRatesError(error instanceof Error ? error.message : '汇率获取失败');
      } finally {
        if (active) {
          setExchangeRatesLoading(false);
        }
      }
    }

    void loadRates();

    return () => {
      active = false;
    };
  }, []);

  async function handleRefreshExchangeRates() {
    setExchangeRatesLoading(true);
    setExchangeRatesError(null);

    try {
      const nextRates = await fetchExchangeRates(true);
      setExchangeRates(nextRates);
    } catch (error) {
      setExchangeRatesError(error instanceof Error ? error.message : '汇率获取失败');
    } finally {
      setExchangeRatesLoading(false);
    }
  }

  const targetRows: TargetRow[] = useMemo(() => {
    if (sourceRows.length === 0) return [];
    return applyMappings(
      sourceRows,
      mappings,
      priceParams,
      exchangeRates,
      productGroups,
      warehouseName,
      templateType
    );
  }, [sourceRows, mappings, priceParams, exchangeRates, productGroups, warehouseName, templateType]);

  const hasData = sourceRows.length > 0;
  const currentPreset = getPricingPreset(priceParams.countryCode);
  const pricingBlockedReason = hasData && !exchangeRates && !exchangeRatesLoading
    ? exchangeRatesError || `未能获取 ${currentPreset.countryName} 定价所需汇率，当前无法导出价格`
    : null;

  return (
    <div className="min-h-screen bg-background animate-fade-in-up">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 glow-coral">
            <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.76a4.86 4.86 0 01-1.02-.07z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground font-heading">TikTok Shop 商品上架工具</h1>
            <p className="text-xs text-muted-foreground">支持店小秘模板与店铺后台模板</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Step indicator — chevron pipeline */}
        {/* Each button has a right-pointing tip (flat left, pointed right).
            Earlier buttons sit on top (zIndex descending) so their tips show
            over the next button's left edge — creating ">" separators. */}
        <div className="flex items-stretch mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            const isEnabled = hasData || s.id === 1;
            const isFirst = i === 0;
            const isLast = i === STEPS.length - 1;
            const C = 14; // chevron tip depth in px

            // Flat left side, right-pointing tip (omit tip on last step).
            const clipPath = isLast
              ? undefined
              : `polygon(0 0, calc(100% - ${C}px) 0, 100% 50%, calc(100% - ${C}px) 100%, 0 100%)`;

            return (
              <button
                key={s.id}
                onClick={() => isEnabled && setStep(s.id)}
                disabled={!isEnabled}
                style={{
                  clipPath,
                  // Earlier buttons rendered on top so their right tips are visible.
                  zIndex: STEPS.length - i,
                  // Shift each non-first button left so the previous tip overlaps it.
                  marginLeft: !isFirst ? `-${C}px` : undefined,
                  // Extra left padding keeps content clear of the overlapping previous tip.
                  paddingLeft: !isFirst ? `${C + 16}px` : '16px',
                  // Extra right padding keeps content clear of this button's own tip.
                  paddingRight: !isLast ? `${C + 8}px` : '16px',
                }}
                className={[
                  'relative flex items-center gap-2 py-2 text-sm font-medium transition-all duration-200 select-none font-heading flex-shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                    ? 'bg-card text-[oklch(0.72_0.17_162)] hover:bg-accent/40'
                    : isEnabled
                    ? 'bg-card text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                    : 'bg-card text-muted-foreground/30 cursor-not-allowed',
                ].join(' ')}
              >
                <span className={[
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  isActive ? 'bg-primary-foreground text-primary' : '',
                  isDone ? 'bg-[oklch(0.72_0.17_162)] text-[oklch(0.12_0.020_162)]' : '',
                  (!isActive && !isDone) ? 'bg-muted/60 text-muted-foreground' : '',
                ].join(' ')}>
                  {isDone ? '✓' : s.id}
                </span>
                <span className="hidden sm:block whitespace-nowrap">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <Card className="glass panel-shadow border-border/60">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 glow-coral font-heading">
                {step}
              </span>
              <div>
                <CardTitle className="text-base font-heading">{STEPS[step - 1].title}</CardTitle>
                <CardDescription>{STEPS[step - 1].desc}</CardDescription>
              </div>
              {hasData && step === 1 && (
                <Badge className="ml-auto bg-[oklch(0.72_0.17_162)]/20 text-[oklch(0.72_0.17_162)] border border-[oklch(0.72_0.17_162)]/30 hover:bg-[oklch(0.72_0.17_162)]/20">
                  {sourceRows.length} 行已加载
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-6">
                <FileUpload onDataParsed={handleDataParsed} />
                {/* Template selector — always visible */}
                <div className="space-y-2">
                  <Label className="text-sm">导出模板</Label>
                  <div className="flex gap-2">
                    {([
                      { value: 'dianxiaomi', label: '店小秘模板', desc: `${TARGET_COLUMNS.length} 列` },
                      { value: 'store', label: '店铺后台模板', desc: `${STORE_BACKEND_TARGET_COLUMNS.length} 列` },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleTemplateChange(opt.value)}
                        className={[
                          'flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 text-left',
                          templateType === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        ].join(' ')}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-xs opacity-70">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {hasData && (
                  <>
                    <div className={[
                      'grid gap-4 p-4 rounded-lg bg-muted/40 border border-border/50',
                      templateType === 'dianxiaomi' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
                    ].join(' ')}>
                      <div className="space-y-1.5">
                        <Label className="text-sm">默认品牌名称</Label>
                        <Input
                          value={defaultBrand}
                          onChange={(e) => handleBrandChange(e.target.value)}
                          placeholder="无品牌"
                        />
                      </div>
                      {templateType === 'dianxiaomi' && (
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-destructive">* 仓库名称（必填）</Label>
                          <Input
                            value={warehouseName}
                            onChange={(e) => {
                              setWarehouseName(e.target.value);
                              setMappings((prev) =>
                                prev.map((m) =>
                                  m.targetColumn === '*仓库名称\n（必填）'
                                    ? { ...m, fixedValue: e.target.value }
                                    : m
                                )
                              );
                            }}
                            placeholder="填写店小秘中配置的仓库名称"
                          />
                        </div>
                      )}
                    </div>
                    <DataPreview headers={sourceHeaders} rows={sourceRows} />
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <ColumnMappingEditor
                mappings={mappings}
                sourceHeaders={sourceHeaders}
                onChange={setMappings}
              />
            )}

            {step === 3 && (
              <VariantAnalysis
                groups={productGroups}
                onGroupsUpdate={setProductGroups}
              />
            )}

            {step === 4 && (
              <PriceCalculator
                params={priceParams}
                sampleRows={sourceRows}
                exchangeRates={exchangeRates}
                exchangeRatesLoading={exchangeRatesLoading}
                exchangeRatesError={exchangeRatesError}
                onChange={setPriceParams}
                onRefreshExchangeRates={handleRefreshExchangeRates}
              />
            )}

            {step === 5 && (
              <CategoryConfig
                groups={productGroups}
                onGroupsUpdate={setProductGroups}
              />
            )}

            {step === 6 && (
              <ExportPreview rows={targetRows} pricingBlockedReason={pricingBlockedReason} templateType={templateType} />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            上一步
          </Button>
          {step < 6 && (
            <Button
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              disabled={!hasData}
              className="glow-coral"
            >
              {step === 5 ? '前往导出' : '下一步'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
