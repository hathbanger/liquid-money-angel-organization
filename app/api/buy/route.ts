/**
 * @purpose POST /api/buy — server-side x402 v2 buyer.
 *
 * Body:
 *   {
 *     slug:        string                // collision slug (e.g. "crypto-onboarding--cryosift")
 *     shape:       ProductShape          // "tee" | "hoodie" | "mug" | ...
 *     quantity?:   number                // default 1
 *     sellerUrl?:  string                // optional absolute override; otherwise
 *                                         // we build `${X402_SELLER_URL_BASE}/${slug}/${shape}`
 *     maxAmount?:  string                // optional client-side cap (USDC, decimal)
 *   }
 *
 * Flow:
 *   1. Resolve seller URL (override or env-based template).
 *   2. Call `fetchWithPayment(url, { method: 'POST', ... })`. The wrapper
 *      handles the 402 by signing a PaymentPayload with the server's EVM
 *      signer and retrying with the X-PAYMENT header.
 *   3. On success, parse the settle response from the response headers and
 *      return a normalized receipt to the client.
 *   4. On failure, surface the upstream status + body and a hint about what
 *      to check (config, balance, network).
 */

import { NextRequest, NextResponse } from 'next/server';
import { decodePaymentResponseHeader } from '@x402/fetch';
import { getX402Buyer, isX402Configured, X402ConfigError } from '@/lib/x402-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_SHAPES = new Set(['tee', 'hoodie', 'mug', 'sticker', 'tote', 'poster']);

interface BuyRequest {
  slug?: string;
  shape?: string;
  quantity?: number;
  sellerUrl?: string;
  maxAmount?: string;
}

export async function GET() {
  const status = isX402Configured();
  return NextResponse.json({
    configured: status.ok,
    reason: status.reason ?? null,
    requires: ['EVM_PRIVATE_KEY', 'X402_SELLER_URL_BASE'],
  });
}

export async function POST(req: NextRequest) {
  let body: BuyRequest;
  try {
    body = (await req.json()) as BuyRequest;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const shape = body.shape?.trim();
  const quantity = Math.max(1, Math.floor(body.quantity ?? 1));

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }
  if (!shape || !ALLOWED_SHAPES.has(shape)) {
    return NextResponse.json(
      { error: `shape must be one of ${[...ALLOWED_SHAPES].join(', ')}` },
      { status: 400 },
    );
  }

  let buyer;
  try {
    buyer = getX402Buyer();
  } catch (err) {
    if (err instanceof X402ConfigError) {
      return NextResponse.json(
        { error: err.message, code: err.code, configured: false },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const sellerUrl =
    body.sellerUrl?.trim() ||
    `${buyer.sellerBase}/${encodeURIComponent(slug)}/${encodeURIComponent(shape)}`;

  try {
    new URL(sellerUrl);
  } catch {
    return NextResponse.json({ error: `invalid seller URL: ${sellerUrl}` }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await buyer.fetch(sellerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, shape, quantity, buyer: buyer.account.address }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `x402 fetch failed: ${(err as Error).message}`,
        sellerUrl,
        hint: 'Check EVM_PRIVATE_KEY funds on Base Sepolia, seller availability, and that the seller speaks x402 v2.',
      },
      { status: 502 },
    );
  }

  // Read body once — fall back to text if not JSON.
  const rawText = await upstream.text();
  let upstreamBody: unknown = rawText;
  try {
    upstreamBody = JSON.parse(rawText);
  } catch {
    /* leave as text */
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        sellerUrl,
        upstreamStatus: upstream.status,
        upstreamBody,
        hint: upstream.status === 402
          ? 'Seller still requires payment after the buyer retry — the buyer wallet may be unfunded or the scheme/network mismatched.'
          : 'Seller returned a non-200 response after payment was attempted.',
      },
      { status: upstream.status },
    );
  }

  // PAYMENT-RESPONSE header carries the settle receipt on success. Falls back
  // to null if the seller didn't include one (rare but legal for free routes).
  let settle: unknown = null;
  const paymentResponse = upstream.headers.get('payment-response') ?? upstream.headers.get('PAYMENT-RESPONSE');
  if (paymentResponse) {
    try {
      settle = decodePaymentResponseHeader(paymentResponse);
    } catch (err) {
      console.warn('[buy] failed to decode PAYMENT-RESPONSE header:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    sellerUrl,
    slug,
    shape,
    quantity,
    buyer: buyer.account.address,
    settle,
    upstreamBody,
  });
}
