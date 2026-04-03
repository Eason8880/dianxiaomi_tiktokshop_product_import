import { SourceRow, ProductGroup } from '@/types';

/**
 * Group source rows by ERP ID to form product groups.
 * Each group represents one product with potentially multiple SKU variants.
 */
export function groupByProduct(rows: SourceRow[]): ProductGroup[] {
  const groupMap = new Map<string, SourceRow[]>();

  for (const row of rows) {
    const erpId = String(row['ERP ID'] || '').trim();
    if (!erpId) continue;

    if (!groupMap.has(erpId)) {
      groupMap.set(erpId, []);
    }
    groupMap.get(erpId)!.push(row);
  }

  const groups: ProductGroup[] = [];
  for (const [erpId, groupRows] of groupMap) {
    const firstRow = groupRows[0];
    const hasColorVariant = groupRows.some(
      (r) => String(r['规格1（颜色）'] || '').trim() !== ''
    );
    const hasSizeVariant = groupRows.some(
      (r) => String(r['规格2（尺寸）'] || '').trim() !== ''
    );

    groups.push({
      erpId,
      chineseName: String(firstRow['产品中文名'] || ''),
      productTitle: String(firstRow['商品名称1'] || firstRow['商品名称'] || ''),
      rows: groupRows,
      hasColorVariant,
      hasSizeVariant,
    });
  }

  return groups;
}
