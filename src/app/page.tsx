'use client';

import { useState, useMemo } from 'react';
import { SourceRow, ColumnMapping, PriceParams, ProductGroup, TargetRow } from '@/types';
import { DEFAULT_MAPPINGS, DEFAULT_PRICE_PARAMS } from '@/lib/constants';
import { groupByProduct } from '@/lib/product-grouper';
import { applyMappings } from '@/lib/column-mapping';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { ColumnMappingEditor } from '@/components/ColumnMapping';
import { PriceCalculator } from '@/components/PriceCalculator';
import { VariantAnalysis } from '@/components/VariantAnalysis';
import { CategoryConfig } from '@/components/CategoryConfig';
import { ExportPreview } from '@/components/ExportPreview';
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

export default function Home() {
  const [step, setStep] = useState(1);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>(DEFAULT_MAPPINGS);
  const [priceParams, setPriceParams] = useState<PriceParams>(DEFAULT_PRICE_PARAMS);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [warehouseName, setWarehouseName] = useState('');
  const [defaultBrand, setDefaultBrand] = useState('无品牌');

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

  const targetRows: TargetRow[] = useMemo(() => {
    if (sourceRows.length === 0) return [];
    return applyMappings(sourceRows, mappings, priceParams, productGroups, warehouseName);
  }, [sourceRows, mappings, priceParams, productGroups, warehouseName]);

  const hasData = sourceRows.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.76a4.86 4.86 0 01-1.02-.07z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">TikTok Shop 商品上架工具</h1>
            <p className="text-xs text-gray-400">店小秘批量上架表格生成器</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => (hasData || s.id === 1) && setStep(s.id)}
                disabled={!hasData && s.id > 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  step === s.id
                    ? 'bg-black text-white'
                    : hasData || s.id === 1
                    ? 'bg-white text-gray-600 hover:bg-gray-100 border'
                    : 'bg-white text-gray-300 border cursor-not-allowed'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step === s.id
                    ? 'bg-white text-black'
                    : step > s.id
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </span>
                <span className="hidden sm:block">{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 flex-shrink-0 ${step > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {step}
              </span>
              <div>
                <CardTitle className="text-lg">{STEPS[step - 1].title}</CardTitle>
                <CardDescription>{STEPS[step - 1].desc}</CardDescription>
              </div>
              {hasData && step === 1 && (
                <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                  {sourceRows.length} 行已加载
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-6">
                <FileUpload onDataParsed={handleDataParsed} />
                {hasData && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-1.5">
                        <Label className="text-sm">默认品牌名称</Label>
                        <Input
                          value={defaultBrand}
                          onChange={(e) => handleBrandChange(e.target.value)}
                          placeholder="无品牌"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-red-600">* 仓库名称（必填）</Label>
                        <Input
                          value={warehouseName}
                          onChange={(e) => setWarehouseName(e.target.value)}
                          placeholder="填写店小秘中配置的仓库名称"
                        />
                      </div>
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
                onChange={setPriceParams}
              />
            )}

            {step === 5 && (
              <CategoryConfig
                groups={productGroups}
                onGroupsUpdate={setProductGroups}
              />
            )}

            {step === 6 && (
              <ExportPreview rows={targetRows} />
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
            >
              {step === 5 ? '前往导出' : '下一步'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
