import { ColumnMapping, PriceParams } from '@/types';

// Source column headers (from ERP export, 40 columns)
export const SOURCE_COLUMNS = [
  'ERP类目',           // 0
  'ERP ID',            // 1
  '产品中文名',         // 2
  '产品属性',           // 3
  '成本（有差值）',      // 4
  '发货重量（有差值）',   // 5
  '属性状态',           // 6
  '属性数量',           // 7
  '类目',              // 8
  '商品名称',           // 9
  '商品描述',           // 10
  '商品重量(g)',        // 11
  '商品长度(cm)',       // 12
  '商品宽度(cm)',       // 13
  '商品高度(cm)',       // 14
  '规格1（颜色）',      // 15
  '规格1图片',          // 16
  '规格2（尺寸）',      // 17
  '全球商品价格',       // 18
  '全球商品库存',       // 19
  'Seller SKU',        // 20
  '商品主图',           // 21
  '尺码图',            // 22
  '商品图片2',          // 23
  '商品图片3',          // 24
  '商品图片4',          // 25
  '商品图片5',          // 26
  '商品图片6',          // 27
  '商品图片7',          // 28
  '商品图片8',          // 29
  '商品图片9',          // 30
  '所有图片链接',       // 31
  '描述（不包括图片）',  // 32
  '产品特点1',          // 33
  '产品特点2',          // 34
  '产品特点3',          // 35
  '商品名称1',          // 36
  '所有图片链接1',      // 37
  '发货重量（有差值）1', // 38
  '前十张图片',         // 39
] as const;

// Target template column headers (店小秘 TikTokShop template, 35 columns)
// Exact text matching the template file (including newlines)
export const TARGET_COLUMNS = [
  '*分类id\n（必填）',
  '*产品标题\n（必填）',
  '*产品描述\n（必填）',
  '品牌',
  '产品属性',
  'SKU',
  '变种属性名称一',
  '变种属性值一',
  '变种属性名称二',
  '变种属性值二',
  '变种属性名称三',
  '变种属性值三',
  '识别码类型',
  '识别码',
  '*本地展示价(站点币种)\n（必填）',
  '*库存\n（必填）',
  '*产品主图(URL)地址\n（必填）',
  '附图一',
  '附图二',
  '附图三',
  '附图四',
  '附图五',
  '附图六',
  '附图七',
  '附图八',
  '视频链接',
  '尺码图',
  '变种主题1图片',
  '*重量(kg)\n（必填）',
  '*长(cm)\n（必填）',
  '*宽(cm)\n（必填）',
  '*高(cm)\n（必填）',
  '*仓库名称\n（必填）',
  '货到付款',
  '来源URL',
] as const;

// Short display names for target columns (for UI display)
export const TARGET_COLUMN_DISPLAY: Record<string, string> = {
  '*分类id\n（必填）': '* 分类id',
  '*产品标题\n（必填）': '* 产品标题',
  '*产品描述\n（必填）': '* 产品描述',
  '品牌': '品牌',
  '产品属性': '产品属性',
  'SKU': 'SKU',
  '变种属性名称一': '变种属性名称一',
  '变种属性值一': '变种属性值一',
  '变种属性名称二': '变种属性名称二',
  '变种属性值二': '变种属性值二',
  '变种属性名称三': '变种属性名称三',
  '变种属性值三': '变种属性值三',
  '识别码类型': '识别码类型',
  '识别码': '识别码',
  '*本地展示价(站点币种)\n（必填）': '* 本地展示价',
  '*库存\n（必填）': '* 库存',
  '*产品主图(URL)地址\n（必填）': '* 产品主图URL',
  '附图一': '附图一',
  '附图二': '附图二',
  '附图三': '附图三',
  '附图四': '附图四',
  '附图五': '附图五',
  '附图六': '附图六',
  '附图七': '附图七',
  '附图八': '附图八',
  '视频链接': '视频链接',
  '尺码图': '尺码图',
  '变种主题1图片': '变种主题1图片',
  '*重量(kg)\n（必填）': '* 重量(kg)',
  '*长(cm)\n（必填）': '* 长(cm)',
  '*宽(cm)\n（必填）': '* 宽(cm)',
  '*高(cm)\n（必填）': '* 高(cm)',
  '*仓库名称\n（必填）': '* 仓库名称',
  '货到付款': '货到付款',
  '来源URL': '来源URL',
};

// Check if a target column is required
export function isRequiredColumn(col: string): boolean {
  return col.startsWith('*');
}

// Default column mappings
export const DEFAULT_MAPPINGS: ColumnMapping[] = [
  { targetColumn: '*分类id\n（必填）', sourceColumn: null, transform: 'none', description: '通过TikTok API获取或手动输入' },
  { targetColumn: '*产品标题\n（必填）', sourceColumn: '商品名称1', transform: 'none' },
  { targetColumn: '*产品描述\n（必填）', sourceColumn: '描述（不包括图片）', transform: 'htmlToText' },
  { targetColumn: '品牌', sourceColumn: null, transform: 'fixedValue', fixedValue: '无品牌' },
  { targetColumn: '产品属性', sourceColumn: null, transform: 'none' },
  { targetColumn: 'SKU', sourceColumn: 'Seller SKU', transform: 'none' },
  { targetColumn: '变种属性名称一', sourceColumn: null, transform: 'fixedValue', fixedValue: 'Color' },
  { targetColumn: '变种属性值一', sourceColumn: '规格1（颜色）', transform: 'none' },
  { targetColumn: '变种属性名称二', sourceColumn: null, transform: 'fixedValue', fixedValue: 'Size' },
  { targetColumn: '变种属性值二', sourceColumn: '规格2（尺寸）', transform: 'none' },
  { targetColumn: '变种属性名称三', sourceColumn: null, transform: 'none' },
  { targetColumn: '变种属性值三', sourceColumn: null, transform: 'none' },
  { targetColumn: '识别码类型', sourceColumn: null, transform: 'none' },
  { targetColumn: '识别码', sourceColumn: null, transform: 'none' },
  { targetColumn: '*本地展示价(站点币种)\n（必填）', sourceColumn: null, transform: 'calculated', description: '根据定价公式计算' },
  { targetColumn: '*库存\n（必填）', sourceColumn: '全球商品库存', transform: 'none' },
  { targetColumn: '*产品主图(URL)地址\n（必填）', sourceColumn: '商品主图', transform: 'none' },
  { targetColumn: '附图一', sourceColumn: '商品图片2', transform: 'none' },
  { targetColumn: '附图二', sourceColumn: '商品图片3', transform: 'none' },
  { targetColumn: '附图三', sourceColumn: '商品图片4', transform: 'none' },
  { targetColumn: '附图四', sourceColumn: '商品图片5', transform: 'none' },
  { targetColumn: '附图五', sourceColumn: '商品图片6', transform: 'none' },
  { targetColumn: '附图六', sourceColumn: '商品图片7', transform: 'none' },
  { targetColumn: '附图七', sourceColumn: '商品图片8', transform: 'none' },
  { targetColumn: '附图八', sourceColumn: '商品图片9', transform: 'none' },
  { targetColumn: '视频链接', sourceColumn: null, transform: 'none' },
  { targetColumn: '尺码图', sourceColumn: '尺码图', transform: 'none' },
  { targetColumn: '变种主题1图片', sourceColumn: '规格1图片', transform: 'none' },
  { targetColumn: '*重量(kg)\n（必填）', sourceColumn: '商品重量(g)', transform: 'divide1000' },
  { targetColumn: '*长(cm)\n（必填）', sourceColumn: '商品长度(cm)', transform: 'none' },
  { targetColumn: '*宽(cm)\n（必填）', sourceColumn: '商品宽度(cm)', transform: 'none' },
  { targetColumn: '*高(cm)\n（必填）', sourceColumn: '商品高度(cm)', transform: 'none' },
  { targetColumn: '*仓库名称\n（必填）', sourceColumn: null, transform: 'fixedValue', fixedValue: '' },
  { targetColumn: '货到付款', sourceColumn: null, transform: 'fixedValue', fixedValue: '是' },
  { targetColumn: '来源URL', sourceColumn: null, transform: 'none' },
];

// Default price calculation parameters
export const DEFAULT_PRICE_PARAMS: PriceParams = {
  exchangeRate: 7.2,
  firstMileRate: 8,
  lastMileRate: 60,
  profitMultiplier: 2.0,
  platformFeeRate: 0.08,
  additionalCost: 1.0,
};
