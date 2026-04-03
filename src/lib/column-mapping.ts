import { ColumnMapping, SourceRow, TargetRow, PriceParams, ProductGroup } from '@/types';
import { TARGET_COLUMNS } from './constants';
import { calculatePrice } from './price-calculator';

/**
 * Convert HTML text literals to plain text.
 * The source description often contains literal <br/> text (not actual HTML tags)
 * that were double-encoded during the HTML-table export.
 */
function htmlToText(value: string): string {
  let text = value;
  // Replace literal <br/>, <br>, <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Strip any remaining HTML-like tags
  text = text.replace(/<[^>]+>/g, '');
  // Clean up excessive whitespace while preserving newlines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  return text.trim();
}

/**
 * Apply column mappings to transform source data into target format.
 */
export function applyMappings(
  sourceRows: SourceRow[],
  mappings: ColumnMapping[],
  priceParams: PriceParams,
  productGroups: ProductGroup[],
  warehouseName: string
): TargetRow[] {
  // Build a map from ERP ID to product group for category lookup
  const groupMap = new Map<string, ProductGroup>();
  for (const group of productGroups) {
    groupMap.set(group.erpId, group);
  }

  return sourceRows.map((sourceRow) => {
    const targetRow: TargetRow = {};
    const erpId = String(sourceRow['ERP ID'] || '');
    const group = groupMap.get(erpId);
    const isVariantProduct = group ? group.rows.length > 1 || group.hasColorVariant : false;

    for (const mapping of mappings) {
      const { targetColumn, sourceColumn, transform, fixedValue } = mapping;
      let value: string | number = '';

      // Handle warehouse name
      if (targetColumn === '*仓库名称\n（必填）') {
        value = warehouseName;
        targetRow[targetColumn] = value;
        continue;
      }

      // Handle category ID from TikTok API
      if (targetColumn === '*分类id\n（必填）') {
        value = group?.recommendedCategoryId || '';
        targetRow[targetColumn] = value;
        continue;
      }

      // Handle calculated price
      if (transform === 'calculated') {
        value = calculatePrice(sourceRow, priceParams);
        targetRow[targetColumn] = value;
        continue;
      }

      // Handle fixed value
      if (transform === 'fixedValue') {
        // For variant attribute names, only fill if product has variants
        if (targetColumn === '变种属性名称一') {
          value = isVariantProduct ? (fixedValue || 'Color') : '';
        } else if (targetColumn === '变种属性名称二') {
          value = (isVariantProduct && group?.hasSizeVariant) ? (fixedValue || 'Size') : '';
        } else {
          value = fixedValue || '';
        }
        targetRow[targetColumn] = value;
        continue;
      }

      // Handle mapped source column
      if (sourceColumn && sourceColumn in sourceRow) {
        const rawValue = sourceRow[sourceColumn];

        switch (transform) {
          case 'divide1000':
            value = Number(rawValue) ? Math.round((Number(rawValue) / 1000) * 1000) / 1000 : '';
            break;
          case 'htmlToText':
            value = htmlToText(String(rawValue || ''));
            break;
          default:
            value = rawValue ?? '';
        }
      }

      // For variant-specific columns, clear if not a variant product
      if (!isVariantProduct) {
        if (['SKU', '变种属性值一', '变种属性值二', '变种属性名称一', '变种属性名称二',
             '变种属性名称三', '变种属性值三', '变种主题1图片'].includes(targetColumn)) {
          value = '';
        }
      }

      // For size variant columns, clear if product has no size variant
      if (isVariantProduct && !group?.hasSizeVariant) {
        if (['变种属性名称二', '变种属性值二'].includes(targetColumn)) {
          value = '';
        }
      }

      targetRow[targetColumn] = value;
    }

    return targetRow;
  });
}

/**
 * Get a preview of what a single source row would look like after mapping.
 */
export function previewMapping(
  sourceRow: SourceRow,
  mappings: ColumnMapping[],
  priceParams: PriceParams
): Record<string, string> {
  const preview: Record<string, string> = {};

  for (const mapping of mappings) {
    const { targetColumn, sourceColumn, transform, fixedValue } = mapping;

    if (transform === 'calculated') {
      preview[targetColumn] = String(calculatePrice(sourceRow, priceParams));
      continue;
    }

    if (transform === 'fixedValue') {
      preview[targetColumn] = fixedValue || '';
      continue;
    }

    if (!sourceColumn || !(sourceColumn in sourceRow)) {
      preview[targetColumn] = '';
      continue;
    }

    const rawValue = sourceRow[sourceColumn];
    switch (transform) {
      case 'divide1000':
        preview[targetColumn] = Number(rawValue)
          ? String(Math.round((Number(rawValue) / 1000) * 1000) / 1000)
          : '';
        break;
      case 'htmlToText':
        preview[targetColumn] = htmlToText(String(rawValue || '')).substring(0, 100);
        break;
      default:
        preview[targetColumn] = String(rawValue ?? '').substring(0, 100);
    }
  }

  return preview;
}

/**
 * Validate that all required target columns have mappings.
 */
export function validateMappings(mappings: ColumnMapping[]): string[] {
  const errors: string[] = [];
  for (const col of TARGET_COLUMNS) {
    if (!col.startsWith('*')) continue;
    const mapping = mappings.find((m) => m.targetColumn === col);
    if (!mapping) {
      errors.push(`必填列 "${col.replace('\n', '')}" 未找到映射配置`);
      continue;
    }
    // Category ID and price are special - they can be filled later
    if (col === '*分类id\n（必填）' || col === '*本地展示价(站点币种)\n（必填）') continue;
    if (!mapping.sourceColumn && mapping.transform !== 'fixedValue' && mapping.transform !== 'calculated') {
      errors.push(`必填列 "${col.replace('\n', '')}" 未配置数据来源`);
    }
  }
  return errors;
}
