'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import { AICategoryCandidate, ProductGroup } from '@/types';
import { CATEGORY_LOOKUP_REGION } from '@/lib/constants';
import {
  analyzeCategoryForGroupWithAI,
  batchAnalyzeCategoriesWithAI,
  batchFetchCategories,
} from '@/lib/tiktok-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CategoryConfigProps {
  groups: ProductGroup[];
  onGroupsUpdate: Dispatch<SetStateAction<ProductGroup[]>>;
}

function mergeGroupsByErpId(current: ProductGroup[], next: ProductGroup[]): ProductGroup[] {
  const nextMap = new Map(next.map((group) => [group.erpId, group]));
  return current.map((group) => nextMap.get(group.erpId) || group);
}

export function CategoryConfig({ groups, onGroupsUpdate }: CategoryConfigProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentAction, setCurrentAction] = useState<'all' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzingAiErpIds, setAnalyzingAiErpIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function runAIFallbackForGroups(failedGroups: ProductGroup[]) {
    if (failedGroups.length === 0) return;

    setCurrentAction('ai');
    setProgress(0);

    const result = await batchAnalyzeCategoriesWithAI(
      failedGroups,
      CATEGORY_LOOKUP_REGION,
      (current, total, erpId) => {
        setProgress(total > 0 ? Math.round((current / total) * 100) : 0);
        setCurrentProduct(erpId);
      },
      abortRef.current?.signal,
      (updatedGroup) => {
        onGroupsUpdate((prev) => mergeGroupsByErpId(prev, [updatedGroup]));
      }
    );

    onGroupsUpdate((prev) => mergeGroupsByErpId(prev, result.groups));
  }

  async function handleFetchAll() {
    setError(null);
    setIsFetching(true);
    setProgress(0);
    setCurrentAction('all');

    abortRef.current = new AbortController();

    try {
      const result = await batchFetchCategories(
        groups,
        CATEGORY_LOOKUP_REGION,
        (current, total, erpId) => {
          setProgress(total > 0 ? Math.round((current / total) * 100) : 0);
          setCurrentProduct(erpId);
        },
        abortRef.current.signal,
        (updatedGroup) => {
          onGroupsUpdate((prev) => mergeGroupsByErpId(prev, [updatedGroup]));
        }
      );
      onGroupsUpdate(result.groups);
      await runAIFallbackForGroups(
        result.groups.filter((group) => !group.recommendedCategoryId && group.categoryLookupError)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取类目失败');
    } finally {
      setIsFetching(false);
      setCurrentProduct('');
      setCurrentAction(null);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsFetching(false);
    setCurrentAction(null);
  }

  function updateCategory(erpId: string, categoryId: string) {
    onGroupsUpdate((prev) =>
      prev.map((g) =>
        g.erpId !== erpId
          ? g
          : categoryId === g.recommendedCategoryId
            ? { ...g, recommendedCategoryId: categoryId }
            : {
                ...g,
                recommendedCategoryId: categoryId,
                categorySource: undefined,
                categoryName: undefined,
                categoryPath: undefined,
              }
      )
    );
  }

  async function handleAnalyzeAI(erpId: string) {
    const group = groups.find((item) => item.erpId === erpId);
    if (!group || analyzingAiErpIds.includes(erpId)) return;

    setError(null);
    setAnalyzingAiErpIds((prev) => [...prev, erpId]);

    try {
      const result = await analyzeCategoryForGroupWithAI(group, CATEGORY_LOOKUP_REGION);
      onGroupsUpdate((prev) =>
        prev.map((item) => (item.erpId === erpId ? result.group : item))
      );
    } finally {
      setAnalyzingAiErpIds((prev) => prev.filter((id) => id !== erpId));
    }
  }

  function applyAICandidate(erpId: string, candidate: AICategoryCandidate) {
    onGroupsUpdate((prev) =>
      prev.map((group) => {
        if (group.erpId !== erpId) return group;
        return {
          ...group,
          recommendedCategoryId: candidate.categoryId,
          categorySource: 'ai',
          categoryName: candidate.categoryPath[candidate.categoryPath.length - 1] || candidate.categoryId,
          categoryPath: candidate.categoryPath,
          categoryLookupError: undefined,
          aiCategoryCandidates: undefined,
          aiCategoryError: undefined,
          aiAnalyzedTitle: undefined,
        };
      })
    );
  }

  function isAnalyzingAI(erpId: string) {
    return analyzingAiErpIds.includes(erpId);
  }

  function renderCategorySource(group: ProductGroup) {
    if (group.categorySource === 'tiktok') {
      return <Badge variant="outline" className="text-blue-600 border-blue-200">TikTok 推荐</Badge>;
    }

    if (group.categorySource === 'ai') {
      return <Badge variant="outline" className="text-amber-700 border-amber-200">AI 分析</Badge>;
    }

    return <span className="text-xs text-gray-400">—</span>;
  }

  const filledCount = groups.filter((g) => g.recommendedCategoryId).length;
  const unresolvedCount = groups.filter(
    (group) =>
      !group.recommendedCategoryId &&
      !group.aiCategoryCandidates?.length &&
      (group.categoryLookupError || group.aiCategoryError)
  ).length;
  const candidatePendingCount = groups.filter(
    (group) => !group.recommendedCategoryId && Boolean(group.aiCategoryCandidates?.length)
  ).length;
  const hasActiveSingleRetry = analyzingAiErpIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Batch fetch */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleFetchAll}
          disabled={isFetching || hasActiveSingleRetry}
          className="gap-2"
        >
          {isFetching ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              获取中…
            </>
          ) : (
            '批量获取推荐类目（PH）'
          )}
        </Button>
        {isFetching && (
          <Button variant="outline" size="sm" onClick={handleStop}>停止</Button>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          已填写 {filledCount} / {groups.length} 个产品
        </span>
      </div>

      {isFetching && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-400">
            {currentProduct
              ? `${currentAction === 'ai'
                  ? '正在进行 AI 类目分析'
                  : '正在处理'}：ERP ID ${currentProduct}`
              : '准备中…'}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(unresolvedCount > 0 || candidatePendingCount > 0) && !isFetching && (
        <Alert>
          <AlertDescription>
            处理逻辑为：先调用 TikTok API 推荐类目，失败后自动切换到 AI 类目分析。
            已有类目但不满意时，也可以点击单个商品的 AI 分析重新选择。
            {candidatePendingCount > 0 ? ` 当前有 ${candidatePendingCount} 个商品已有 AI 候选类目待确认。` : ''}
            {unresolvedCount > 0 ? ` 仍有 ${unresolvedCount} 个商品需要人工处理或再次触发 AI 分析。` : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Product category table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-44">ERP ID / 中文名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">产品名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">变体数</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-48">分类 ID（必填）</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">类目来源</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">状态</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.erpId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <p className="text-gray-600 font-mono text-xs">{group.erpId}</p>
                  <p className="text-gray-800 text-xs mt-1">{group.chineseName || '未提供中文名'}</p>
                </td>
                <td className="px-4 py-2">
                  <p className="text-gray-800 text-xs truncate max-w-[320px]" title={group.productTitle}>
                    {group.productTitle || group.chineseName || '未提供产品标题'}
                  </p>
                  {group.recommendedCategoryId && group.categoryPath && group.categoryPath.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
                      {group.categoryPath.map((seg, idx) => (
                        <span key={idx} className="flex items-center gap-0.5">
                          {idx > 0 && <span className="text-gray-300 text-xs">›</span>}
                          <span className="text-gray-400 text-xs">{seg}</span>
                        </span>
                      ))}
                    </div>
                  ) : group.recommendedCategoryId && group.categoryName ? (
                    <p className="text-gray-400 text-xs mt-0.5">{group.categoryName}</p>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    {(group.categoryLookupError || group.aiCategoryError) ? (
                      <div className="space-y-1">
                        {group.categoryLookupError ? (
                          <p className="text-xs text-red-500">{group.categoryLookupError}</p>
                        ) : null}
                        {group.aiCategoryError ? (
                          <p className="text-xs text-orange-500">{group.aiCategoryError}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {!group.aiCategoryCandidates?.length ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyzeAI(group.erpId)}
                        disabled={isFetching || isAnalyzingAI(group.erpId)}
                      >
                        {isAnalyzingAI(group.erpId)
                          ? 'AI 分析中…'
                          : group.recommendedCategoryId
                            ? 'AI 重新分析'
                            : 'AI 分析'}
                      </Button>
                    ) : null}
                    {group.aiCategoryCandidates && group.aiCategoryCandidates.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-dashed border-gray-200 bg-gray-50 p-2">
                        <p className="text-xs font-medium text-gray-600">
                          AI 候选类目{group.aiAnalyzedTitle ? `（分析标题：${group.aiAnalyzedTitle}）` : ''}
                        </p>
                        {group.aiCategoryCandidates.map((candidate) => (
                          <div
                            key={`${group.erpId}-${candidate.categoryId}`}
                            className="flex items-start justify-between gap-3 rounded-md bg-white px-2 py-2"
                          >
                            <div className="space-y-1">
                              <p className="text-xs text-gray-700">{candidate.categoryPath.join(' > ')}</p>
                              <p className="text-[11px] text-gray-400">{candidate.reason}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyAICandidate(group.erpId, candidate)}
                              disabled={isFetching}
                            >
                              应用
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2 text-center text-gray-500">{group.rows.length}</td>
                <td className="px-4 py-2">
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="输入分类 ID…"
                    value={group.recommendedCategoryId || ''}
                    onChange={(e) => updateCategory(group.erpId, e.target.value)}
                    disabled={isFetching}
                  />
                </td>
                <td className="px-4 py-2">
                  {renderCategorySource(group)}
                </td>
                <td className="px-4 py-2">
                  {group.recommendedCategoryId ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已填写</Badge>
                  ) : group.aiCategoryCandidates?.length ? (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待确认</Badge>
                  ) : group.categoryLookupError || group.aiCategoryError ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">待处理</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400">待填写</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
