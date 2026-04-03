'use client';

import { useRef, useState } from 'react';
import { ProductGroup } from '@/types';
import { CATEGORY_LOOKUP_REGION } from '@/lib/constants';
import { batchFetchCategories, fetchCategoryForGroup } from '@/lib/tiktok-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CategoryConfigProps {
  groups: ProductGroup[];
  onGroupsUpdate: (groups: ProductGroup[]) => void;
}

function mergeGroupsByErpId(current: ProductGroup[], next: ProductGroup[]): ProductGroup[] {
  const nextMap = new Map(next.map((group) => [group.erpId, group]));
  return current.map((group) => nextMap.get(group.erpId) || group);
}

export function CategoryConfig({ groups, onGroupsUpdate }: CategoryConfigProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentAction, setCurrentAction] = useState<'all' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryingErpIds, setRetryingErpIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

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
        abortRef.current.signal
      );
      onGroupsUpdate(result.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取类目失败');
    } finally {
      setIsFetching(false);
      setCurrentProduct('');
      setCurrentAction(null);
    }
  }

  async function handleRetryFailed() {
    const failedGroups = groups.filter((group) => !group.recommendedCategoryId && group.categoryLookupError);
    if (failedGroups.length === 0) return;

    setError(null);
    setIsFetching(true);
    setProgress(0);
    setCurrentAction('failed');

    abortRef.current = new AbortController();

    try {
      const result = await batchFetchCategories(
        failedGroups,
        CATEGORY_LOOKUP_REGION,
        (current, total, erpId) => {
          setProgress(total > 0 ? Math.round((current / total) * 100) : 0);
          setCurrentProduct(erpId);
        },
        abortRef.current.signal
      );
      onGroupsUpdate(mergeGroupsByErpId(groups, result.groups));
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试失败项失败');
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
    const updated = groups.map((g) =>
      g.erpId === erpId ? { ...g, recommendedCategoryId: categoryId } : g
    );
    onGroupsUpdate(updated);
  }

  function updateLookupTitle(erpId: string, title: string) {
    const updated = groups.map((group) =>
      group.erpId === erpId ? { ...group, categoryLookupTitle: title } : group
    );
    onGroupsUpdate(updated);
  }

  async function handleRetryOne(erpId: string) {
    const group = groups.find((item) => item.erpId === erpId);
    if (!group) return;

    setError(null);
    setRetryingErpIds((prev) => [...prev, erpId]);

    try {
      const result = await fetchCategoryForGroup(group, CATEGORY_LOOKUP_REGION);
      const updated = groups.map((item) => (item.erpId === erpId ? result.group : item));
      onGroupsUpdate(updated);
    } finally {
      setRetryingErpIds((prev) => prev.filter((id) => id !== erpId));
    }
  }

  function isRetrying(erpId: string) {
    return retryingErpIds.includes(erpId);
  }

  const filledCount = groups.filter((g) => g.recommendedCategoryId).length;
  const failedCount = groups.filter((g) => !g.recommendedCategoryId && g.categoryLookupError).length;
  const hasActiveSingleRetry = retryingErpIds.length > 0;

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
        <Button
          variant="outline"
          onClick={handleRetryFailed}
          disabled={isFetching || hasActiveSingleRetry || failedCount === 0}
        >
          重试失败项{failedCount > 0 ? `（${failedCount}）` : ''}
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
              ? `${currentAction === 'failed' ? '正在重试失败项' : '正在处理'}：ERP ID ${currentProduct}`
              : '准备中…'}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {failedCount > 0 && !isFetching && (
        <Alert>
          <AlertDescription>
            {failedCount} 个商品未获取成功，可修改“类目查询标题”后单独重试，或点击上方按钮批量重试失败项。
          </AlertDescription>
        </Alert>
      )}

      {/* Product category table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">ERP ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">产品名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">变体数</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-48">分类 ID（必填）</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">状态</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.erpId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{group.erpId}</td>
                <td className="px-4 py-2">
                  <p className="text-gray-800 text-xs truncate max-w-[320px]" title={group.productTitle}>
                    {group.productTitle || group.chineseName}
                  </p>
                  {!group.recommendedCategoryId && group.categoryLookupError ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-gray-400">
                        原始标题仅用于导出，不会被下面的查询标题覆盖。
                      </p>
                      <Input
                        className="h-8 text-xs"
                        placeholder={group.productTitle || group.chineseName || '输入类目查询标题…'}
                        value={group.categoryLookupTitle || ''}
                        onChange={(e) => updateLookupTitle(group.erpId, e.target.value)}
                        disabled={isFetching || hasActiveSingleRetry}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryOne(group.erpId)}
                          disabled={isFetching || hasActiveSingleRetry}
                        >
                          {isRetrying(group.erpId) ? '重试中…' : '重试'}
                        </Button>
                        <span className="text-xs text-red-500">{group.categoryLookupError}</span>
                      </div>
                    </div>
                  ) : null}
                  {group.categoryPath && group.categoryPath.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
                      {group.categoryPath.map((seg, idx) => (
                        <span key={idx} className="flex items-center gap-0.5">
                          {idx > 0 && <span className="text-gray-300 text-xs">›</span>}
                          <span className="text-gray-400 text-xs">{seg}</span>
                        </span>
                      ))}
                    </div>
                  ) : group.categoryName ? (
                    <p className="text-gray-400 text-xs mt-0.5">{group.categoryName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-center text-gray-500">{group.rows.length}</td>
                <td className="px-4 py-2">
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="输入分类 ID…"
                    value={group.recommendedCategoryId || ''}
                    onChange={(e) => updateCategory(group.erpId, e.target.value)}
                    disabled={isFetching || hasActiveSingleRetry}
                  />
                </td>
                <td className="px-4 py-2">
                  {group.recommendedCategoryId ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已填写</Badge>
                  ) : group.categoryLookupError ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">获取失败</Badge>
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
