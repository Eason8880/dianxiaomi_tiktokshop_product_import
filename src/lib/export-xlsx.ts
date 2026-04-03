'use client';

import { TargetRow } from '@/types';
import { TARGET_COLUMNS } from './constants';

/**
 * Export target rows to an xlsx file using the Dianxiaomi template as base.
 * Uses exceljs to preserve the template's header formatting (red font, wrap text).
 */
export async function exportToXlsx(
  rows: TargetRow[],
  filename?: string
): Promise<void> {
  // Dynamic import to avoid SSR issues
  const ExcelJS = (await import('exceljs')).default;
  const { saveAs } = await import('file-saver');

  // Fetch the template file from public directory
  const templateResponse = await fetch('/template_tiktok.xlsx');
  if (!templateResponse.ok) {
    throw new Error('无法加载模板文件，请确认 template_tiktok.xlsx 存在于 public 目录');
  }
  const templateBuffer = await templateResponse.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const sheet = workbook.getWorksheet(1);
  if (!sheet) {
    throw new Error('模板文件格式错误：未找到工作表');
  }

  // Find the header row (row 1) to determine column order
  const headerRow = sheet.getRow(1);
  const colIndexMap = new Map<string, number>(); // targetColumn -> xlsx column index (1-based)

  headerRow.eachCell((cell, colNum) => {
    const text = String(cell.value || '').trim();
    // Match against target columns (handle newlines in cell values)
    for (const col of TARGET_COLUMNS) {
      const normalizedCol = col.replace(/\n/g, '\n');
      if (text === normalizedCol.replace(/\n/g, '\n') || text === col.replace('\n', '\n')) {
        colIndexMap.set(col, colNum);
        break;
      }
    }
  });

  // If col map is empty, build it by position order
  if (colIndexMap.size === 0) {
    TARGET_COLUMNS.forEach((col, idx) => {
      colIndexMap.set(col, idx + 1);
    });
  }

  // Remove any existing data rows (keep header row 1)
  const lastRow = sheet.lastRow?.number || 1;
  for (let r = lastRow; r >= 2; r--) {
    sheet.spliceRows(r, 1);
  }

  // Write data rows starting from row 2
  for (let i = 0; i < rows.length; i++) {
    const targetRow = rows[i];
    const excelRow = sheet.getRow(i + 2);

    for (const col of TARGET_COLUMNS) {
      const colIdx = colIndexMap.get(col);
      if (!colIdx) continue;

      const value = targetRow[col];
      const cell = excelRow.getCell(colIdx);

      if (value === null || value === undefined || value === '') {
        cell.value = null;
      } else if (typeof value === 'number') {
        cell.value = value;
      } else {
        const strVal = String(value);
        cell.value = strVal;
      }
    }

    excelRow.commit();
  }

  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .substring(0, 14);
  saveAs(blob, filename || `dianxiaomi_tiktok_${ts}.xlsx`);
}
