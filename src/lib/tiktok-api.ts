import { ProductGroup, CategoryRecommendation } from '@/types';

export interface CategoryFetchResponse {
  categories: CategoryRecommendation[];
  matchedTitle?: string;
  attemptedTitles?: string[];
}

export interface CategoryLookupResult {
  group: ProductGroup;
  error?: string;
}

/**
 * Fetch recommended categories for a product via the server-side API proxy.
 */
export async function fetchRecommendedCategory(
  productTitle: string,
  region: string,
  description?: string,
  images?: string[]
): Promise<CategoryFetchResponse> {
  const response = await fetch('/api/tiktok-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productTitle,
      region,
      description,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return {
    categories: (data.categories || []).map((cat: Record<string, unknown>) => ({
      categoryId: String(cat.id || cat.category_id || ''),
      categoryName: String(cat.local_name || cat.name || cat.category_name || ''),
      confidence: Number(cat.confidence || 0),
      isLeaf: Boolean(cat.is_leaf),
      categoryPath: Array.isArray(cat.categoryPath) ? (cat.categoryPath as string[]) : undefined,
    })),
    matchedTitle: typeof data.matchedTitle === 'string' ? data.matchedTitle : undefined,
    attemptedTitles: Array.isArray(data.attemptedTitles)
      ? data.attemptedTitles.filter((title: unknown): title is string => typeof title === 'string')
      : undefined,
  };
}

function pickBestCategory(categories: CategoryRecommendation[]): CategoryRecommendation | undefined {
  const sorted = [...categories].sort((a, b) => {
    const aLeaf = a.isLeaf ? 1 : 0;
    const bLeaf = b.isLeaf ? 1 : 0;
    if (bLeaf !== aLeaf) return bLeaf - aLeaf;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  return sorted[0];
}

export async function fetchCategoryForGroup(
  group: ProductGroup,
  region: string
): Promise<CategoryLookupResult> {
  const firstRow = group.rows[0];
  const images = [
    String(firstRow['商品主图'] || ''),
    String(firstRow['商品图片2'] || ''),
  ].filter(Boolean);
  const lookupTitle = group.categoryLookupTitle || group.productTitle;

  try {
    const result = await fetchRecommendedCategory(
      lookupTitle,
      region,
      undefined,
      images
    );
    const bestCategory = pickBestCategory(result.categories);

    if (!bestCategory) {
      return {
        group: {
          ...group,
          categoryLookupError: '未返回可用类目',
        },
        error: '未返回可用类目',
      };
    }

    return {
      group: {
        ...group,
        recommendedCategoryId: bestCategory.categoryId,
        categoryName: bestCategory.categoryName,
        categoryPath: bestCategory.categoryPath,
        categoryLookupError: undefined,
        categoryMatchedTitle: result.matchedTitle,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return {
      group: {
        ...group,
        categoryLookupError: message,
      },
      error: message,
    };
  }
}

/**
 * Batch fetch categories for all product groups with rate limiting.
 * Returns updated groups with recommendedCategoryId filled in.
 */
export async function batchFetchCategories(
  groups: ProductGroup[],
  region: string,
  onProgress: (current: number, total: number, groupId: string) => void,
  signal?: AbortSignal
): Promise<{ groups: ProductGroup[]; errors: { erpId: string; message: string }[] }> {
  if (groups.length === 0) {
    throw new Error('没有可处理的产品，请先上传数据并完成列映射');
  }

  const updated = [...groups];
  const errors: { erpId: string; message: string }[] = [];

  for (let i = 0; i < updated.length; i++) {
    if (signal?.aborted) break;

    const group = updated[i];
    onProgress(i, updated.length, group.erpId);

    const result = await fetchCategoryForGroup(group, region);
    updated[i] = result.group;

    if (result.error) {
      const message = result.error;
      errors.push({ erpId: group.erpId, message });
      console.error(`Failed to fetch category for ERP ID ${group.erpId}:`, message);
    }

    // Rate limiting: 1s between requests
    if (i < updated.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  onProgress(updated.length, updated.length, '');
  return { groups: updated, errors };
}
