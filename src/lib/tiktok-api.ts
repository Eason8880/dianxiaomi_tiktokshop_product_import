import { ProductGroup, CategoryRecommendation } from '@/types';

/**
 * Fetch recommended categories for a product via the server-side API proxy.
 */
export async function fetchRecommendedCategory(
  productTitle: string,
  region: string,
  description?: string,
  images?: string[]
): Promise<CategoryRecommendation[]> {
  const response = await fetch('/api/tiktok-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productTitle,
      region,
      description,
      images: images?.slice(0, 3),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return (data.categories || []).map((cat: Record<string, unknown>) => ({
    categoryId: String(cat.id || cat.category_id || ''),
    categoryName: String(cat.local_name || cat.category_name || cat.name || ''),
    confidence: Number(cat.confidence || 0),
  }));
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

    try {
      const firstRow = group.rows[0];
      const images = [
        String(firstRow['商品主图'] || ''),
        String(firstRow['商品图片2'] || ''),
      ].filter(Boolean);

      const categories = await fetchRecommendedCategory(
        group.productTitle,
        region,
        String(firstRow['描述（不包括图片）'] || '').substring(0, 500),
        images
      );

      if (categories.length > 0) {
        const sorted = [...categories].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        updated[i] = {
          ...group,
          recommendedCategoryId: sorted[0].categoryId,
          categoryName: sorted[0].categoryName,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      errors.push({ erpId: group.erpId, message });
      console.error(`Failed to fetch category for ERP ID ${group.erpId}:`, err);
    }

    // Rate limiting: 500ms between requests
    if (i < updated.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  onProgress(updated.length, updated.length, '');
  return { groups: updated, errors };
}
