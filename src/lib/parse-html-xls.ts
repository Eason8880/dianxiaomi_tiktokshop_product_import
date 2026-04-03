import { SourceRow } from '@/types';

/**
 * Parse an HTML-disguised .xls file (common format from Chinese ERP systems).
 * The file is actually an HTML document with a <table> containing data.
 */
export function parseHtmlXls(htmlContent: string): {
  headers: string[];
  rows: SourceRow[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    throw new Error('未找到表格数据，请确认上传的文件格式正确');
  }

  const allRows = table.querySelectorAll('tr');
  if (allRows.length < 2) {
    throw new Error('表格数据为空');
  }

  // First row = headers
  const headerRow = allRows[0];
  const headerCells = headerRow.querySelectorAll('th, td');
  const headers: string[] = [];
  headerCells.forEach((cell) => {
    headers.push(cleanCellText(cell));
  });

  // Data rows
  const rows: SourceRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const tr = allRows[i];
    const cells = tr.querySelectorAll('td');
    if (cells.length === 0) continue;

    const row: SourceRow = {};
    cells.forEach((cell, idx) => {
      const header = headers[idx] || `col_${idx}`;
      const text = cleanCellText(cell);
      // Try parsing as number for numeric columns
      const num = parseFloat(text);
      if (text !== '' && !isNaN(num) && isNumericColumn(header)) {
        row[header] = num;
      } else {
        row[header] = text;
      }
    });
    rows.push(row);
  }

  return { headers, rows };
}

function cleanCellText(cell: Element): string {
  // Get innerHTML, replace <br> variants with newline, then extract text
  let html = cell.innerHTML;
  html = html.replace(/<br\s*\/?>/gi, '\n');
  // Create a temporary element to decode HTML entities
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent?.trim() || '';
}

// Columns that should be parsed as numbers
const NUMERIC_COLUMNS = new Set([
  '成本（有差值）',
  '发货重量（有差值）',
  '属性数量',
  '商品重量(g)',
  '商品长度(cm)',
  '商品宽度(cm)',
  '商品高度(cm)',
  '全球商品价格',
  '全球商品库存',
  '发货重量（有差值）1',
]);

function isNumericColumn(header: string): boolean {
  return NUMERIC_COLUMNS.has(header);
}
