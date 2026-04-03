import crypto from 'crypto';

export interface TikTokCategory {
  id: string;
  name?: string;
  local_name?: string;
  parent_id?: string;
  is_leaf?: boolean;
  level?: number;
  permission_statuses?: string[];
}

export interface TikTokLeafCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
}

interface CategoryTreeCacheEntry {
  fetchedAt: number;
  pathMap: Map<string, string[]>;
  leafCategories: TikTokLeafCategory[];
}

const CATEGORY_TREE_TTL_MS = 30 * 60 * 1000;
const categoryTreeCache = new Map<string, CategoryTreeCacheEntry>();

export function generateTikTokSignature(
  path: string,
  queryParams: Record<string, string>,
  body: string,
  appSecret: string
): string {
  const sortedKeys = Object.keys(queryParams)
    .filter((k) => k !== 'sign' && k !== 'access_token')
    .sort();

  let baseString = path;
  for (const key of sortedKeys) {
    baseString += key + queryParams[key];
  }
  baseString += body;

  const signString = appSecret + baseString + appSecret;

  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex');
}

async function fetchRawCategoryTree(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string
): Promise<TikTokCategory[]> {
  const apiPath = '/product/202309/categories';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const queryParams: Record<string, string> = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp,
    locale: 'en',
  };

  const sign = generateTikTokSignature(apiPath, queryParams, '', appSecret);
  const queryString = new URLSearchParams({ ...queryParams, sign }).toString();
  const apiUrl = `https://open-api.tiktokglobalshop.com${apiPath}?${queryString}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(data.message || '获取类目树失败');
  }

  return data.data?.category_list || data.data?.categories || [];
}

async function fetchCategoryTreeCacheEntry(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string
): Promise<CategoryTreeCacheEntry> {
  const cacheKey = `${shopCipher}:en`;
  const cached = categoryTreeCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATEGORY_TREE_TTL_MS) {
    return cached;
  }

  const categories = await fetchRawCategoryTree(appKey, appSecret, shopCipher, accessToken);
  const catMap = new Map<string, TikTokCategory>();
  for (const cat of categories) {
    catMap.set(String(cat.id), cat);
  }

  const pathMap = new Map<string, string[]>();
  function buildPath(id: string): string[] {
    if (pathMap.has(id)) return pathMap.get(id)!;
    const cat = catMap.get(id);
    if (!cat) return [];

    const name = cat.local_name || cat.name || id;
    const parentId = String(cat.parent_id || '');
    if (!parentId || parentId === '0') {
      const path = [name];
      pathMap.set(id, path);
      return path;
    }

    const path = [...buildPath(parentId), name];
    pathMap.set(id, path);
    return path;
  }

  const leafCategories: TikTokLeafCategory[] = [];
  for (const cat of categories) {
    const categoryId = String(cat.id);
    const categoryPath = buildPath(categoryId);
    if (cat.is_leaf) {
      leafCategories.push({
        categoryId,
        categoryName: cat.local_name || cat.name || categoryId,
        categoryPath,
      });
    }
  }

  const entry: CategoryTreeCacheEntry = {
    fetchedAt: Date.now(),
    pathMap,
    leafCategories,
  };
  categoryTreeCache.set(cacheKey, entry);
  return entry;
}

export async function fetchCategoryPathMap(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string
): Promise<Map<string, string[]>> {
  return (await fetchCategoryTreeCacheEntry(appKey, appSecret, shopCipher, accessToken)).pathMap;
}

export async function fetchLeafCategories(
  appKey: string,
  appSecret: string,
  shopCipher: string,
  accessToken: string
): Promise<TikTokLeafCategory[]> {
  return (await fetchCategoryTreeCacheEntry(appKey, appSecret, shopCipher, accessToken)).leafCategories;
}
