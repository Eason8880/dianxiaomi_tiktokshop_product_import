'use client';

import { useState } from 'react';
import { SourceRow } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DataPreviewProps {
  headers: string[];
  rows: SourceRow[];
}

const PAGE_SIZE = 20;

export function DataPreview({ headers, rows }: DataPreviewProps) {
  const [page, setPage] = useState(0);

  // Group rows by ERP ID for color coding
  const erpIds = rows.map((r) => String(r['ERP ID'] || ''));
  const uniqueErpIds = [...new Set(erpIds)];
  const erpColorMap = new Map(uniqueErpIds.map((id, i) => [id, i % 2 === 0]));

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm text-gray-500">
          <span>共 <strong>{rows.length}</strong> 行数据</span>
          <span>·</span>
          <span><strong>{uniqueErpIds.length}</strong> 个产品</span>
          <span>·</span>
          <span><strong>{headers.length}</strong> 列</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              上一页
            </Button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              下一页
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="text-xs min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">#</th>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap max-w-[180px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const erpId = String(row['ERP ID'] || '');
              const isEven = erpColorMap.get(erpId);
              return (
                <tr
                  key={idx}
                  className={`border-b last:border-0 hover:bg-yellow-50 transition-colors ${
                    isEven ? 'bg-white' : 'bg-blue-50/30'
                  }`}
                >
                  <td className={`px-3 py-2 text-gray-400 sticky left-0 z-10 ${isEven ? 'bg-white' : 'bg-blue-50/30'}`}>
                    {page * PAGE_SIZE + idx + 1}
                  </td>
                  {headers.map((h) => {
                    const val = String(row[h] ?? '');
                    const isLong = val.length > 60;
                    return (
                      <td
                        key={h}
                        className="px-3 py-2 text-gray-700 max-w-[200px] truncate"
                        title={isLong ? val : undefined}
                      >
                        {val || <span className="text-gray-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 text-xs text-gray-400">
        <Badge variant="outline" className="text-gray-500">白色行</Badge>
        <span>和</span>
        <Badge variant="outline" className="bg-blue-50/50 text-gray-500">蓝色行</Badge>
        <span>表示不同产品（按 ERP ID 区分）</span>
      </div>
    </div>
  );
}
