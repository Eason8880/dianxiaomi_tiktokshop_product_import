'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ProductGroup, VariantDimension } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VariantAnalysisProps {
  groups: ProductGroup[];
  onGroupsUpdate: Dispatch<SetStateAction<ProductGroup[]>>;
}

type ProductMode = 'has_规格' | 'has_attrs' | 'no_variants';

function mergeGroupsByErpId(current: ProductGroup[], next: ProductGroup[]): ProductGroup[] {
  const nextMap = new Map(next.map((g) => [g.erpId, g]));
  return current.map((g) => nextMap.get(g.erpId) || g);
}

function classifyGroup(group: ProductGroup): ProductMode {
  // 规格1 和 规格2 都有值 → 已是标准二维，无需分析
  if (group.hasColorVariant && group.hasSizeVariant) return 'has_规格';
  // 有 规格1（颜色）但无 规格2（尺寸），或只有 产品属性
  // → 交给 AI 语义判断是 1 维还是 2 维，不依赖分隔符检测
  if (group.hasColorVariant || group.rows.some((r) => String(r['产品属性'] || '').trim() !== '')) {
    return 'has_attrs';
  }
  return 'no_variants';
}

/** 取待分析的属性列表：优先 产品属性，备用 规格1（颜色） */
function dedupAttributes(group: ProductGroup): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  // 先从 产品属性 取
  for (const r of group.rows) {
    const v = String(r['产品属性'] || '').trim();
    if (v && !seen.has(v)) { seen.add(v); result.push(v); }
  }
  // 若 产品属性 全空，回退到 规格1（颜色）
  if (result.length === 0) {
    for (const r of group.rows) {
      const v = String(r['规格1（颜色）'] || '').trim();
      if (v && !seen.has(v)) { seen.add(v); result.push(v); }
    }
  }
  return result;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface SingleResult {
  erpId: string;
  dimensions: 1 | 2;
  dim1_name: string;
  dim2_name?: string;
  splits: Record<string, string[]>;
}

function buildDim(splits: Record<string, string[]>, idx: number): VariantDimension['valueMap'] {
  return Object.fromEntries(
    Object.entries(splits).map(([k, v]) => [k, v[idx] ?? ''])
  );
}

function applyResults(prev: ProductGroup[], results: SingleResult[]): ProductGroup[] {
  const resultMap = new Map(results.map((r) => [r.erpId, r]));
  return prev.map((g) => {
    const r = resultMap.get(g.erpId);
    if (!r) return g;
    const dim1: VariantDimension = { name: r.dim1_name, valueMap: buildDim(r.splits, 0) };
    const dim2: VariantDimension | undefined =
      r.dimensions === 2 && r.dim2_name
        ? { name: r.dim2_name, valueMap: buildDim(r.splits, 1) }
        : undefined;
    return {
      ...g,
      variantAnalysisStatus: 'done' as const,
      variantAnalysisError: undefined,
      variantDimCount: r.dimensions,
      variantDim1: dim1,
      variantDim2: dim2,
    };
  });
}

export function VariantAnalysis({ groups, onGroupsUpdate }: VariantAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState('');
  const [singleAnalyzingIds, setSingleAnalyzingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const hasAutoTriggered = useRef(false);

  // Auto-trigger on mount if there are products needing analysis
  useEffect(() => {
    if (hasAutoTriggered.current) return;
    const needsAnalysis = groups.some(
      (g) => classifyGroup(g) === 'has_attrs' && !g.variantAnalysisStatus
    );
    if (needsAnalysis) {
      hasAutoTriggered.current = true;
      handleAnalyzeAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callAnalyzeAPI(
    batch: ProductGroup[],
    signal?: AbortSignal
  ): Promise<SingleResult[]> {
    const response = await fetch('/api/analyze-variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: batch.map((g) => ({
          erpId: g.erpId,
          chineseName: g.chineseName,
          attributes: dedupAttributes(g),
        })),
      }),
      signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return Array.isArray(data.results) ? data.results : [];
  }

  async function handleAnalyzeAll() {
    const toAnalyze = groups.filter(
      (g) => classifyGroup(g) === 'has_attrs' && g.variantAnalysisStatus !== 'done'
    );
    if (!toAnalyze.length) return;

    setError(null);
    setIsAnalyzing(true);
    setProgress(0);
    abortRef.current = new AbortController();

    const chunks = chunkArray(toAnalyze, 20);
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.current.signal.aborted) break;
        const chunk = chunks[i];
        setCurrentProduct(chunk[0].chineseName || chunk[0].erpId);

        // Mark chunk as pending
        onGroupsUpdate((prev) =>
          prev.map((g) =>
            chunk.some((c) => c.erpId === g.erpId)
              ? { ...g, variantAnalysisStatus: 'pending' }
              : g
          )
        );

        try {
          const results = await callAnalyzeAPI(chunk, abortRef.current.signal);
          onGroupsUpdate((prev) => applyResults(prev, results));
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') break;
          // Mark this chunk as error
          const msg = err instanceof Error ? err.message : '分析失败';
          onGroupsUpdate((prev) =>
            prev.map((g) =>
              chunk.some((c) => c.erpId === g.erpId)
                ? { ...g, variantAnalysisStatus: 'error', variantAnalysisError: msg }
                : g
            )
          );
        }

        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      }
    } finally {
      setIsAnalyzing(false);
      setCurrentProduct('');
    }
  }

  async function handleAnalyzeSingle(erpId: string) {
    const group = groups.find((g) => g.erpId === erpId);
    if (!group || singleAnalyzingIds.includes(erpId)) return;

    setError(null);
    setSingleAnalyzingIds((prev) => [...prev, erpId]);
    onGroupsUpdate((prev) =>
      prev.map((g) => (g.erpId === erpId ? { ...g, variantAnalysisStatus: 'pending' } : g))
    );

    try {
      const results = await callAnalyzeAPI([group]);
      onGroupsUpdate((prev) => applyResults(prev, results));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败';
      onGroupsUpdate((prev) =>
        prev.map((g) =>
          g.erpId === erpId
            ? { ...g, variantAnalysisStatus: 'error', variantAnalysisError: msg }
            : g
        )
      );
      setError(msg);
    } finally {
      setSingleAnalyzingIds((prev) => prev.filter((id) => id !== erpId));
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsAnalyzing(false);
    setCurrentProduct('');
  }

  function handleReset(erpId: string) {
    onGroupsUpdate((prev) =>
      prev.map((g) =>
        g.erpId === erpId
          ? {
              ...g,
              variantAnalysisStatus: undefined,
              variantAnalysisError: undefined,
              variantDimCount: undefined,
              variantDim1: undefined,
              variantDim2: undefined,
            }
          : g
      )
    );
  }

  function updateDimName(erpId: string, dim: 1 | 2, name: string) {
    onGroupsUpdate((prev) =>
      mergeGroupsByErpId(prev, [
        {
          ...prev.find((g) => g.erpId === erpId)!,
          ...(dim === 1
            ? {
                variantDim1: {
                  ...prev.find((g) => g.erpId === erpId)!.variantDim1!,
                  name,
                },
              }
            : {
                variantDim2: {
                  ...prev.find((g) => g.erpId === erpId)!.variantDim2!,
                  name,
                },
              }),
        },
      ])
    );
  }

  // Stats
  const needsAnalysis = groups.filter((g) => classifyGroup(g) === 'has_attrs');
  const doneCount = needsAnalysis.filter((g) => g.variantAnalysisStatus === 'done').length;
  const hasReguCount = groups.filter((g) => classifyGroup(g) === 'has_规格').length;
  const noVariantCount = groups.filter((g) => classifyGroup(g) === 'no_variants').length;

  // Sort: has_attrs undone first, then has_attrs done, then has_规格, then no_variants
  const sortOrder: Record<ProductMode, number> = { has_attrs: 0, has_规格: 1, no_variants: 2 };
  const sortedGroups = [...groups].sort((a, b) => {
    const ma = classifyGroup(a);
    const mb = classifyGroup(b);
    if (sortOrder[ma] !== sortOrder[mb]) return sortOrder[ma] - sortOrder[mb];
    // Within has_attrs: undone before done
    if (ma === 'has_attrs') {
      const aD = a.variantAnalysisStatus === 'done' ? 1 : 0;
      const bD = b.variantAnalysisStatus === 'done' ? 1 : 0;
      return aD - bD;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleAnalyzeAll}
          disabled={isAnalyzing || needsAnalysis.length === doneCount}
          className="gap-2"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              分析中…
            </>
          ) : (
            'AI 批量分析变种'
          )}
        </Button>
        {isAnalyzing && (
          <Button variant="outline" size="sm" onClick={handleStop}>
            停止
          </Button>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          待分析 {needsAnalysis.length - doneCount} · 已完成 {doneCount} · 已有规格列 {hasReguCount} · 无变种 {noVariantCount}
        </span>
      </div>

      {isAnalyzing && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-400">
            {currentProduct ? `正在分析：${currentProduct}` : '准备中…'}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {needsAnalysis.length > 0 && (
        <Alert>
          <AlertDescription>
            此步骤通过 AI 分析「产品属性」字段，将组合变种（如"黑色-XS"）拆分为独立维度（颜色、尺寸等），供导出时填入变种属性列。
            已有「规格1/规格2」数据的商品无需分析，会直接使用原有数据。
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-44">ERP ID / 中文名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">变种属性</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-56">维度分析结果</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">状态 / 操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => {
              const mode = classifyGroup(group);
              const attrs = dedupAttributes(group);
              const isSingleAnalyzing = singleAnalyzingIds.includes(group.erpId);

              return (
                <tr key={group.erpId} className="border-b last:border-0 hover:bg-gray-50">
                  {/* ERP ID / Name */}
                  <td className="px-4 py-3 align-top">
                    <p className="font-mono text-xs text-gray-500">{group.erpId}</p>
                    <p className="text-xs text-gray-800 mt-0.5">{group.chineseName || '—'}</p>
                  </td>

                  {/* Variant Attributes */}
                  <td className="px-4 py-3 align-top">
                    {mode === 'has_规格' && (
                      <div className="space-y-0.5">
                        {group.hasColorVariant && (
                          <p className="text-xs text-gray-500">
                            颜色：{[...new Set(group.rows.map((r) => String(r['规格1（颜色）'] || '')).filter(Boolean))]
                              .slice(0, 6)
                              .join('、')}
                            {group.rows.length > 6 ? '…' : ''}
                          </p>
                        )}
                        {group.hasSizeVariant && (
                          <p className="text-xs text-gray-500">
                            尺寸：{[...new Set(group.rows.map((r) => String(r['规格2（尺寸）'] || '')).filter(Boolean))]
                              .slice(0, 6)
                              .join('、')}
                          </p>
                        )}
                      </div>
                    )}
                    {mode === 'has_attrs' && (
                      <div className="flex flex-wrap gap-1">
                        {attrs.slice(0, 8).map((a) => (
                          <span
                            key={a}
                            className="inline-block bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded"
                          >
                            {a}
                          </span>
                        ))}
                        {attrs.length > 8 && (
                          <span className="text-xs text-gray-400 self-center">
                            +{attrs.length - 8} 个
                          </span>
                        )}
                      </div>
                    )}
                    {mode === 'no_variants' && (
                      <span className="text-xs text-gray-400">无变种属性</span>
                    )}
                  </td>

                  {/* Analysis Result */}
                  <td className="px-4 py-3 align-top">
                    {mode === 'has_规格' && (
                      <div className="flex flex-wrap gap-1">
                        {group.hasColorVariant && (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                            Color 已有
                          </Badge>
                        )}
                        {group.hasSizeVariant && (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                            Size 已有
                          </Badge>
                        )}
                      </div>
                    )}
                    {mode === 'no_variants' && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                    {mode === 'has_attrs' && group.variantAnalysisStatus === 'done' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Input
                            className="h-6 text-xs w-24 px-1.5"
                            value={group.variantDim1?.name ?? ''}
                            onChange={(e) => updateDimName(group.erpId, 1, e.target.value)}
                            title="维度1名称（可修改）"
                          />
                          {group.variantDim2 && (
                            <>
                              <span className="text-gray-400 text-xs font-medium">×</span>
                              <Input
                                className="h-6 text-xs w-24 px-1.5"
                                value={group.variantDim2?.name ?? ''}
                                onChange={(e) => updateDimName(group.erpId, 2, e.target.value)}
                                title="维度2名称（可修改）"
                              />
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {group.variantDimCount === 2 ? '2 个维度' : '1 个维度'} · {attrs.length} 个变种
                        </p>
                        {/* Splits list with expand/collapse */}
                        {group.variantDim1 && (() => {
                          const entries = Object.entries(group.variantDim1.valueMap);
                          const isExpanded = expandedIds.has(group.erpId);
                          const visible = isExpanded ? entries : entries.slice(0, 3);
                          return (
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {visible.map(([raw, v1]) => (
                                <div key={raw} className="font-mono">
                                  {raw} →{' '}
                                  <span className="text-blue-600">{v1}</span>
                                  {group.variantDim2 && (
                                    <>
                                      {' + '}
                                      <span className="text-amber-600">
                                        {group.variantDim2.valueMap[raw]}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                              {entries.length > 3 && (
                                <button
                                  className="text-blue-500 hover:text-blue-700 text-xs mt-0.5"
                                  onClick={() =>
                                    setExpandedIds((prev) => {
                                      const next = new Set(prev);
                                      isExpanded ? next.delete(group.erpId) : next.add(group.erpId);
                                      return next;
                                    })
                                  }
                                >
                                  {isExpanded ? '收起' : `展开全部（共 ${entries.length} 条）`}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {mode === 'has_attrs' && group.variantAnalysisStatus === 'error' && (
                      <p className="text-xs text-red-500">{group.variantAnalysisError}</p>
                    )}
                    {mode === 'has_attrs' &&
                      (!group.variantAnalysisStatus || group.variantAnalysisStatus === 'pending') && (
                        <span className="text-xs text-gray-400">
                          {group.variantAnalysisStatus === 'pending' ? '分析中…' : '待分析'}
                        </span>
                      )}
                  </td>

                  {/* Status / Actions */}
                  <td className="px-4 py-3 align-top">
                    {mode === 'has_规格' && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                        已有规格列
                      </Badge>
                    )}
                    {mode === 'no_variants' && (
                      <Badge variant="outline" className="text-gray-400 text-xs">
                        无变种
                      </Badge>
                    )}
                    {mode === 'has_attrs' && (
                      <div className="space-y-1.5">
                        {group.variantAnalysisStatus === 'done' && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs block w-fit">
                            已分析
                          </Badge>
                        )}
                        {group.variantAnalysisStatus === 'error' && (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs block w-fit">
                            失败
                          </Badge>
                        )}
                        {group.variantAnalysisStatus === 'pending' && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            分析中
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleAnalyzeSingle(group.erpId)}
                          disabled={isAnalyzing || isSingleAnalyzing}
                        >
                          {isSingleAnalyzing
                            ? '分析中…'
                            : group.variantAnalysisStatus === 'done'
                              ? '重新分析'
                              : 'AI 分析'}
                        </Button>
                        {group.variantAnalysisStatus === 'done' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-gray-400 hover:text-red-500"
                            onClick={() => handleReset(group.erpId)}
                            disabled={isAnalyzing || isSingleAnalyzing}
                            title="清除分析结果，回退到原始规格列数据"
                          >
                            重置
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
