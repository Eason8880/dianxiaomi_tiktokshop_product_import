import { NextResponse } from 'next/server';

const REGION_NAMES: Record<string, string> = {
  MY: '马来西亚',
  PH: '菲律宾',
  TH: '泰国',
  SG: '新加坡',
  US: '美国',
  GB: '英国',
  ID: '印度尼西亚',
  VN: '越南',
};

/**
 * Returns the list of configured shop regions from TIKTOK_SHOPS env var.
 * Format: {"MY":"cipher...","PH":"cipher..."}
 */
export async function GET() {
  const shopsEnv = process.env.TIKTOK_SHOPS;
  if (!shopsEnv) {
    return NextResponse.json({ regions: [] });
  }

  try {
    const shops: Record<string, string> = JSON.parse(shopsEnv);
    const regions = Object.keys(shops).map((code) => ({
      code,
      name: REGION_NAMES[code] || code,
    }));
    return NextResponse.json({ regions });
  } catch {
    return NextResponse.json({ regions: [] });
  }
}
