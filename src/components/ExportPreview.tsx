'use client';

import { useState } from 'react';
import { TargetRow, TemplateType } from '@/types';
import {
  TARGET_COLUMNS, TARGET_COLUMN_DISPLAY,
  STORE_BACKEND_TARGET_COLUMNS, STORE_BACKEND_TARGET_COLUMN_DISPLAY,
  isRequiredColumn,
} from '@/lib/constants';
import { exportToXlsx } from '@/lib/export-xlsx';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getZebraStickyToneClass, getZebraTableToneClass } from '@/lib/table-contrast';

interface ExportPreviewProps {
  rows: TargetRow[];
  pricingBlockedReason?: string | null;
  templateType?: TemplateType;
}

const PAGE_SIZE = 20;

export function ExportPreview({ rows, pricingBlockedReason, templateType = 'dianxiaomi' }: ExportPreviewProps) {
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isStore = templateType === 'store';
  const activeColumns = isStore ? STORE_BACKEND_TARGET_COLUMNS : TARGET_COLUMNS;
  const displayMap = isStore ? STORE_BACKEND_TARGET_COLUMN_DISPLAY : TARGET_COLUMN_DISPLAY;

  // Validate required columns (store template has no * prefixed columns, so this is dianxiaomi only)
  const missingRequired: { rowIdx: number; col: string }[] = [];
  rows.forEach((row, i) => {
    for (const col of activeColumns) {
      if (!isRequiredColumn(col)) continue;
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
      await exportToXlsx(rows, undefined, templateType);
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
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>共 <strong className="text-foreground">{rows.length}</strong> 行</span>
          <span>·</span>
          <span><strong className="text-foreground">{activeColumns.length}</strong> 列</span>
          {missingRequired.length > 0 && (
            <>
              <span>·</span>
              <span className="text-[oklch(0.75_0.15_80)] font-medium">
                {missingRequired.length} 处必填项为空
              </span>
            </>
          )}
        </div>
        <Button onClick={handleExport} disabled={exporting || Boolean(pricingBlockedReason)} className="gap-2">
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

      {pricingBlockedReason && (
        <Alert variant="destructive">
          <AlertDescription>{pricingBlockedReason}</AlertDescription>
        </Alert>
      )}

      {missingRequired.length > 0 && (
        <Alert className="border-[oklch(0.75_0.15_80)]/30 bg-[oklch(0.75_0.15_80)]/10">
          <AlertDescription className="text-[oklch(0.75_0.15_80)] text-xs">
            以下必填项为空，导出文件可能无法直接导入店小秘。分类 ID 可在导出后手动填写。
            <br />
            {[...new Set(missingRequired.map((m) => displayMap[m.col] || m.col))].join('、')}
          </AlertDescription>
        </Alert>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* Preview table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="text-xs min-w-max">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-3 py-2 text-left text-muted-foreground/50 sticky left-0 bg-muted/40 z-10">#</th>
              {activeColumns.map((col) => {
                const display = displayMap[col] || col;
                const req = isRequiredColumn(col);
                return (
                  <th
                    key={col}
                    className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                      req ? 'text-destructive' : 'text-muted-foreground'
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
              const rowToneClass = getZebraTableToneClass(idx);
              const stickyToneClass = getZebraStickyToneClass(idx);
              return (
                <tr key={idx} className={`border-b last:border-0 border-border transition-colors ${rowToneClass}`}>
                  <td className={`px-3 py-2 text-muted-foreground/50 sticky left-0 z-10 ${stickyToneClass}`}>{globalIdx + 1}</td>
                  {activeColumns.map((col) => {
                    const val = row[col];
                    const isEmpty = val === null || val === undefined || val === '';
                    const req = isRequiredColumn(col);
                    const isMissing = req && isEmpty && col !== '*分类id\n（必填）';

                    return (
                      <td
                        key={col}
                        className={`px-3 py-2 max-w-[200px] truncate ${
                          isMissing
                            ? 'bg-[oklch(0.75_0.15_80)]/10 text-[oklch(0.75_0.15_80)]'
                            : isEmpty
                            ? 'text-muted-foreground/20'
                            : 'text-foreground'
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
