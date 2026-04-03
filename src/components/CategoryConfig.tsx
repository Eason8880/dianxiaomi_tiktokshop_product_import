'use client';

import { useState, useRef, useEffect } from 'react';
import { ProductGroup } from '@/types';
import { batchFetchCategories } from '@/lib/tiktok-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Region {
  code: string;
  name: string;
}

interface CategoryConfigProps {
  groups: ProductGroup[];
  onGroupsUpdate: (groups: ProductGroup[]) => void;
}

export function CategoryConfig({ groups, onGroupsUpdate }: CategoryConfigProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<{ erpId: string; message: string }[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/tiktok-shops')
      .then((r) => r.json())
      .then((data) => {
        setRegions(data.regions || []);
        if (data.regions?.length > 0) {
          setSelectedRegion(data.regions[0].code);
        }
      })
      .catch(() => {});
  }, []);

  async function handleFetchAll() {
    if (!selectedRegion) {
      setError('请选择目标国家/地区');
      return;
    }
    setError(null);
    setBatchErrors([]);
    setIsFetching(true);
    setProgress(0);

    abortRef.current = new AbortController();

    try {
      const result = await batchFetchCategories(
        groups,
        selectedRegion,
        (current, total, erpId) => {
          setProgress(total > 0 ? Math.round((current / total) * 100) : 0);
          setCurrentProduct(erpId);
        },
        abortRef.current.signal
      );
      onGroupsUpdate(result.groups);
      if (result.errors.length > 0) {
        setBatchErrors(result.errors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取类目失败');
    } finally {
      setIsFetching(false);
      setCurrentProduct('');
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsFetching(false);
  }

  function updateCategory(erpId: string, categoryId: string) {
    const updated = groups.map((g) =>
      g.erpId === erpId ? { ...g, recommendedCategoryId: categoryId } : g
    );
    onGroupsUpdate(updated);
  }

  const filledCount = groups.filter((g) => g.recommendedCategoryId).length;

  return (
    <div className="space-y-6">
      {/* Region selector + batch fetch */}
      <div className="flex items-center gap-3 flex-wrap">
        {regions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">目标国家</span>
            <div className="flex gap-1.5">
              {regions.map((r) => (
                <button
                  key={r.code}
                  onClick={() => setSelectedRegion(r.code)}
                  disabled={isFetching}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                    selectedRegion === r.code
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">未配置店铺信息</span>
        )}

        <Button
          onClick={handleFetchAll}
          disabled={isFetching || !selectedRegion}
          className="gap-2"
        >
          {isFetching ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              获取中…
            </>
          ) : (
            '批量获取推荐类目'
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
            {currentProduct ? `正在处理：ERP ID ${currentProduct}` : '准备中…'}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {batchErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium mb-1">{batchErrors.length} 个产品获取失败：</p>
            <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
              {batchErrors.map((e) => (
                <li key={e.erpId}>ERP {e.erpId}：{e.message}</li>
              ))}
            </ul>
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
                  />
                </td>
                <td className="px-4 py-2">
                  {group.recommendedCategoryId ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已填写</Badge>
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
