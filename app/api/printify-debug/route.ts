/**
 * @purpose GET /api/printify-debug
 *   Cheap sanity check: confirms PRINTIFY_API_TOKEN is loaded into the
 *   server process AND that the token actually talks to Printify. Returns
 *   the shop list so we know the env var has been picked up before
 *   spending API budget on /api/company-merch.
 *
 * No mutations, no spending. Safe to hit repeatedly.
 */

import { NextResponse } from 'next/server';
import { listShops, PrintifyError } from '@/lib/printify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasToken = !!process.env.PRINTIFY_API_TOKEN;
  const hasShopId = !!process.env.PRINTIFY_SHOP_ID;

  if (!hasToken) {
    return NextResponse.json({
      ok: false,
      has_token: false,
      hint: 'PRINTIFY_API_TOKEN is not set in the server process. Restart the dev server after editing .env.',
    });
  }

  try {
    const shops = await listShops();
    return NextResponse.json({
      ok: true,
      has_token: true,
      has_shop_id_env: hasShopId,
      shop_count: shops.length,
      shops: shops.map((s) => ({ id: s.id, title: s.title, sales_channel: s.sales_channel })),
    });
  } catch (err) {
    const msg = err instanceof PrintifyError
      ? `${err.status ?? ''} ${err.message} — ${err.body?.slice(0, 200) ?? ''}`
      : err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      has_token: true,
      error: msg,
    }, { status: 502 });
  }
}
