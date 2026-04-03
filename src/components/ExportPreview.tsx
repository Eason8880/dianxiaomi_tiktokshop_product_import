'use client';

import { useState } from 'react';
import { TargetRow } from '@/types';
import { TARGET_COLUMNS, TARGET_COLUMN_DISPLAY, isRequiredColumn } from '@/lib/constants';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExportPreviewProps {
  rows: TargetRow[];
}

const PAGE_SIZE = 20;

export function ExportPreview({ rows }: ExportPreviewProps) {
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Validate required columns
  const missingRequired: { rowIdx: number; col: string }[] = [];
  rows.forEach((row, i) => {
    for (const col of TARGET_COLUMNS) {
      if (!isRequiredColumn(col)) continue;
      // Category ID is optional (can be empty if user hasn't set it)
      if (col === '*分类id\n（必填）') continue;
      const val = row[col];
      if (val === null || val === undefined || val === '') {
        missingRequired.push({ rowIdx: i, col });
      }
    }
  });

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await exportToXlsx(rows);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary + export button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 text-sm text-gray-500">
          <span>共 <strong>{rows.length}</strong> 行</span>
          <span>·</span>
          <span><strong>{TARGET_COLUMNS.length}</strong> 列</span>
          {missingRequired.length > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600 font-medium">
                {missingRequired.length} 处必填项为空
              </span>
            </>
          )}
        </div>
        <Button onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              导出中…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载 .xlsx
            </>
          )}
        </Button>
      </div>

      {exportError && (
        <Alert variant="destructive">
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}

      {missingRequired.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-700 text-xs">
            以下必填项为空，导出文件可能无法直接导入店小秘。分类 ID 可在导出后手动填写。
            <br />
            {[...new Set(missingRequired.map((m) => TARGET_COLUMN_DISPLAY[m.col] || m.col))].join('、')}
          </AlertDescription>
        </Alert>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* Preview table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="text-xs min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left text-gray-400 sticky left-0 bg-gray-50 z-10">#</th>
              {TARGET_COLUMNS.map((col) => {
                const display = TARGET_COLUMN_DISPLAY[col] || col;
                const req = isRequiredColumn(col);
                return (
                  <th
                    key={col}
                    className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                      req ? 'text-red-600' : 'text-gray-600'
                    }`}
                  >
                    {display}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const globalIdx = page * PAGE_SIZE + idx;
              return (
                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 sticky left-0 bg-white z-10">{globalIdx + 1}</td>
                  {TARGET_COLUMNS.map((col) => {
                    const val = row[col];
                    const isEmpty = val === null || val === undefined || val === '';
                    const req = isRequiredColumn(col);
                    const isMissing = req && isEmpty && col !== '*分类id\n（必填）';

                    return (
                      <td
                        key={col}
                        className={`px-3 py-2 max-w-[200px] truncate ${
                          isMissing
                            ? 'bg-amber-50 text-amber-400'
                            : isEmpty
                            ? 'text-gray-300'
                            : 'text-gray-700'
                        }`}
                        title={String(val || '')}
                      >
                        {isEmpty ? '—' : String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
