/**
 * TikTok Shop Access Token manager.
 *
 * Caches the current access_token in memory and auto-refreshes
 * using the refresh_token when it expires.
 *
 * Env vars required:
 *   TIKTOK_APP_KEY
 *   TIKTOK_APP_SECRET
 *   TIKTOK_REFRESH_TOKEN   – long-lived refresh token from OAuth
 *   TIKTOK_ACCESS_TOKEN    – (optional) seed token; will be refreshed automatically
 */

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0; // unix ms

/**
 * Get a valid access token, refreshing if necessary.
 */
export async function getAccessToken(): Promise<string> {
  // If we have a cached token that hasn't expired (with 60s buffer), use it
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  const appKey = process.env.TIKTOK_APP_KEY!;
  const appSecret = process.env.TIKTOK_APP_SECRET!;

  // If no refresh token configured, fall back to the static access token
  if (!refreshToken) {
    const staticToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (!staticToken) {
      throw new Error('未配置 TIKTOK_ACCESS_TOKEN 或 TIKTOK_REFRESH_TOKEN');
    }
    return staticToken;
  }

  // Call TikTok token refresh API
  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(
    `https://auth.tiktok-shops.com/api/v2/token/refresh?${params.toString()}`,
    { method: 'GET' }
  );

  const data = await response.json();

  if (data.code !== 0 || !data.data?.access_token) {
    console.error('Token refresh failed:', data);
    // Fall back to static token if refresh fails
    const staticToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (staticToken) {
      return staticToken;
    }
    throw new Error(data.message || 'Token 刷新失败');
  }

  cachedAccessToken = data.data.access_token;
  // TikTok tokens typically expire in access_token_expire_in seconds
  const expiresIn = data.data.access_token_expire_in || 0;
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  console.log(`[TikTok Token] Refreshed, expires in ${expiresIn}s`);
  return cachedAccessToken;
}
