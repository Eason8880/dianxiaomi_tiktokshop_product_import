import { AICategoryCandidate, ProductGroup, CategoryRecommendation } from '@/types';
import { fetchWithTimeout, isAbortError } from '@/lib/fetch-timeout';

export interface CategoryFetchResponse {
  categories: CategoryRecommendation[];
  matchedTitle?: string;
  attemptedTitles?: string[];
}

export interface CategoryLookupResult {
  group: ProductGroup;
  error?: string;
}

export interface AICategoryFetchResponse {
  candidates: AICategoryCandidate[];
  analyzedTitle?: string;
  model?: string;
}

export interface AICategoryLookupResult {
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
  images?: string[],
  signal?: AbortSignal
): Promise<CategoryFetchResponse> {
  const response = await fetchWithTimeout('/api/tiktok-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productTitle,
      region,
      description,
    }),
    signal,
    timeoutMs: 25_000,
    timeoutMessage: 'TikTok 类目请求超时，请稍后重试或改用 AI 分析',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return {
    categories: (data.categories || []).map((cat: Record<string, unknown>) => ({
      categoryId: String(cat.id || cat.category_id || ''),
      categoryName: String(
        (Array.isArray(cat.categoryPath) ? cat.categoryPath[cat.categoryPath.length - 1] : undefined) ||
          cat.local_name ||
          cat.name ||
          cat.category_name ||
          ''
      ),
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

export async function analyzeCategoryWithAI(
  productTitle: string,
  region: string,
  signal?: AbortSignal
): Promise<AICategoryFetchResponse> {
  const response = await fetchWithTimeout('/api/tiktok-category-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productTitle,
      region,
    }),
    signal,
    timeoutMs: 90_000,
    timeoutMessage: 'AI 类目分析超时，请稍后重试',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return {
    candidates: Array.isArray(data.candidates)
      ? data.candidates
          .filter((item: Record<string, unknown>) => item.categoryId && Array.isArray(item.categoryPath))
          .map((item: Record<string, unknown>) => ({
            categoryId: String(item.categoryId || ''),
            categoryPath: Array.isArray(item.categoryPath)
              ? item.categoryPath.filter((seg: unknown): seg is string => typeof seg === 'string')
              : [],
            reason: String(item.reason || ''),
            score: typeof item.score === 'number' ? item.score : undefined,
          }))
      : [],
    analyzedTitle: typeof data.analyzedTitle === 'string' ? data.analyzedTitle : undefined,
    model: typeof data.model === 'string' ? data.model : undefined,
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
  region: string,
  signal?: AbortSignal
): Promise<CategoryLookupResult> {
  const firstRow = group.rows[0];
  const images = [
    String(firstRow['商品主图'] || ''),
    String(firstRow['商品图片2'] || ''),
  ].filter(Boolean);
  const lookupTitle = group.productTitle || group.chineseName;

  try {
    const result = await fetchRecommendedCategory(
      lookupTitle,
      region,
      undefined,
      images,
      signal
    );
    const bestCategory = pickBestCategory(result.categories);

    if (!bestCategory) {
      return {
        group: {
          ...group,
          recommendedCategoryId: undefined,
          categorySource: undefined,
          categoryName: undefined,
          categoryPath: undefined,
          categoryLookupError: '未返回可用类目',
        },
        error: '未返回可用类目',
      };
    }

    return {
      group: {
        ...group,
        recommendedCategoryId: bestCategory.categoryId,
        categorySource: 'tiktok',
        categoryName: bestCategory.categoryName,
        categoryPath: bestCategory.categoryPath,
        categoryLookupError: undefined,
        categoryMatchedTitle: result.matchedTitle,
        aiCategoryCandidates: undefined,
        aiCategoryError: undefined,
        aiAnalyzedTitle: undefined,
      },
    };
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : '未知错误';
    return {
      group: {
        ...group,
        recommendedCategoryId: undefined,
        categorySource: undefined,
        categoryName: undefined,
        categoryPath: undefined,
        categoryLookupError: message,
      },
      error: message,
    };
  }
}

export async function analyzeCategoryForGroupWithAI(
  group: ProductGroup,
  region: string,
  signal?: AbortSignal
): Promise<AICategoryLookupResult> {
  const lookupTitle = group.productTitle || group.chineseName;

  try {
    const result = await analyzeCategoryWithAI(lookupTitle, region, signal);
    if (result.candidates.length === 0) {
      return {
        group: {
          ...group,
          aiCategoryCandidates: undefined,
          aiCategoryError: 'AI 未返回可用候选类目',
          aiAnalyzedTitle: result.analyzedTitle,
        },
        error: 'AI 未返回可用候选类目',
      };
    }

    return {
      group: {
        ...group,
        aiCategoryCandidates: result.candidates,
        aiCategoryError: undefined,
        aiAnalyzedTitle: result.analyzedTitle,
      },
    };
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'AI 类目分析失败';
    return {
      group: {
        ...group,
        aiCategoryCandidates: undefined,
        aiCategoryError: message,
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
  signal?: AbortSignal,
  onGroupUpdate?: (group: ProductGroup) => void
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

    let result: CategoryLookupResult;
    try {
      result = await fetchCategoryForGroup(group, region, signal);
    } catch (err) {
      if (isAbortError(err)) {
        break;
      }
      throw err;
    }
    updated[i] = result.group;
    onGroupUpdate?.(result.group);

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

export async function batchAnalyzeCategoriesWithAI(
  groups: ProductGroup[],
  region: string,
  onProgress: (current: number, total: number, groupId: string) => void,
  signal?: AbortSignal,
  onGroupUpdate?: (group: ProductGroup) => void
): Promise<{ groups: ProductGroup[]; errors: { erpId: string; message: string }[] }> {
  if (groups.length === 0) {
    return { groups: [], errors: [] };
  }

  const updated = [...groups];
  const errors: { erpId: string; message: string }[] = [];

  for (let i = 0; i < updated.length; i++) {
    if (signal?.aborted) break;

    const group = updated[i];
    onProgress(i, updated.length, group.erpId);

    let result: AICategoryLookupResult;
    try {
      result = await analyzeCategoryForGroupWithAI(group, region, signal);
    } catch (err) {
      if (isAbortError(err)) {
        break;
      }
      throw err;
    }
    updated[i] = result.group;
    onGroupUpdate?.(result.group);

    if (result.error) {
      errors.push({ erpId: group.erpId, message: result.error });
      console.error(`AI category analysis failed for ERP ID ${group.erpId}:`, result.error);
    }

    if (i < updated.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  onProgress(updated.length, updated.length, '');
  return { groups: updated, errors };
}
