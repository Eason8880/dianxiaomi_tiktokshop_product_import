// Source data row from ERP export (40 columns)
export interface SourceRow {
  [key: string]: string | number;
}

// Target template row for Dianxiaomi TikTokShop (35 columns)
export interface TargetRow {
  [key: string]: string | number;
}

// Variant dimension produced by AI analysis
export interface VariantDimension {
  name: string; // English label: "Color", "Size", "Length", etc.
  valueMap: Record<string, string>; // raw 产品属性 string → extracted value for this dimension
}

// Column mapping configuration
export interface ColumnMapping {
  targetColumn: string;
  sourceColumn: string | null; // null = not mapped
  transform: 'none' | 'divide1000' | 'htmlToText' | 'calculated' | 'fixedValue';
  fixedValue?: string;
  description?: string;
}

export type CountryCode = 'PH' | 'MY' | 'SG' | 'TH' | 'VN';
export type ExchangeRateCode = 'CNY' | 'PHP' | 'MYR' | 'SGD' | 'THB' | 'VND';

// Price calculation parameters
export interface PriceParams {
  countryCode: CountryCode;
  discountRate: number;
}

export interface ExchangeRatesState {
  base: 'USD';
  provider: 'frankfurter';
  providerDate: string;
  rates: Record<ExchangeRateCode, number>;
  fetchedAt: string;
  isStale: boolean;
}

// Product group (multiple SKU rows sharing the same ERP ID)
export interface ProductGroup {
  erpId: string;
  chineseName: string;
  productTitle: string;
  rows: SourceRow[];
  hasColorVariant: boolean;
  hasSizeVariant: boolean;
  variantAnalysisStatus?: 'pending' | 'done' | 'error';
  variantAnalysisSkipped?: boolean;
  variantAnalysisError?: string;
  variantDimCount?: 1 | 2;
  variantDim1?: VariantDimension;
  variantDim2?: VariantDimension;
  categoryLookupTitle?: string;
  categoryLookupError?: string;
  categoryMatchedTitle?: string;
  aiCategoryCandidates?: AICategoryCandidate[];
  aiCategoryError?: string;
  aiAnalyzedTitle?: string;
  recommendedCategoryId?: string;
  categorySource?: 'tiktok' | 'ai';
  categoryName?: string;
  categoryPath?: string[]; // full hierarchy path from root to leaf
}

export interface AICategoryCandidate {
  categoryId: string;
  categoryPath: string[];
  reason: string;
  score?: number;
}

// Category recommendation result
export interface CategoryRecommendation {
  categoryId: string;
  categoryName: string;
  confidence?: number;
  isLeaf?: boolean;
  categoryPath?: string[]; // full path from root to leaf, e.g. ["Fashion", "Accessories", "Rings"]
}

// App state
export interface AppState {
  step: number;
  sourceData: SourceRow[];
  sourceHeaders: string[];
  columnMappings: ColumnMapping[];
  priceParams: PriceParams;
  productGroups: ProductGroup[];
  warehouseName: string;
  defaultBrand: string;
}
