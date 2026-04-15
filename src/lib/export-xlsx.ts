'use client';

import { TargetRow, TemplateType } from '@/types';
import { TARGET_COLUMNS, STORE_BACKEND_TARGET_COLUMNS } from './constants';

/**
 * Export target rows to an xlsx file.
 * Supports two templates: 'dianxiaomi' (店小秘) and 'store' (店铺后台).
 */
export async function exportToXlsx(
  rows: TargetRow[],
  filename?: string,
  templateType: TemplateType = 'dianxiaomi'
): Promise<void> {
  const isStore = templateType === 'store';
  const activeColumns = isStore ? STORE_BACKEND_TARGET_COLUMNS : TARGET_COLUMNS;
  const templateFile = isStore ? '/template_store_backend.xlsx' : '/template_tiktok.xlsx';
  const defaultFilename = isStore ? 'store_backend' : 'dianxiaomi_tiktok';

  // Dynamic import to avoid SSR issues
  const ExcelJS = (await import('exceljs')).default;
  const { saveAs } = await import('file-saver');

  // Fetch the template file from public directory
  const templateResponse = await fetch(templateFile);
  if (!templateResponse.ok) {
    throw new Error(`无法加载模板文件，请确认 ${templateFile} 存在于 public 目录`);
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
    for (const col of activeColumns) {
      if (text === col.replace(/\n/g, '\n')) {
        colIndexMap.set(col, colNum);
        break;
      }
    }
  });

  // If col map is empty, build it by position order
  if (colIndexMap.size === 0) {
    activeColumns.forEach((col, idx) => {
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

    for (const col of activeColumns) {
      const colIdx = colIndexMap.get(col);
      if (!colIdx) continue;

      const value = targetRow[col];
      const cell = excelRow.getCell(colIdx);

      if (value === null || value === undefined || value === '') {
        cell.value = null;
      } else if (typeof value === 'number') {
        cell.value = value;
      } else {
        cell.value = String(value);
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
  saveAs(blob, filename || `${defaultFilename}_${ts}.xlsx`);
}
