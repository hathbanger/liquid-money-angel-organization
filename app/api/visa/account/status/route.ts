/** @purpose Derive a JSON account status (balance, headroom, cards, email) from visa-cli. */
import { NextResponse } from 'next/server';
import { getAccountStatus, VisaCliError } from '@/lib/visa-cli';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Cache module-level for short windows so concurrent client polls don't hammer the CLI.
let cached: { ts: number; data: Awaited<ReturnType<typeof getAccountStatus>> } | null = null;
const TTL_MS = 10_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('refresh') === '1';

  if (!force && cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ ...cached.data, _cache: 'hit' });
  }

  try {
    const status = await getAccountStatus();
    cached = { ts: Date.now(), data: status };
    return NextResponse.json({ ...status, _cache: 'miss' });
  } catch (err) {
    if (err instanceof VisaCliError) {
      const httpStatus = err.code === 'NOT_FOUND' ? 503 : err.code === 'TIMEOUT' ? 504 : 502;
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          enrolled: false,
          email: null,
          balance: null,
          currency: 'USD',
          spending: {
            dailyLimit: null,
            dailySpent: null,
            dailyRemaining: null,
            maxPerTxn: null,
          },
          cards: { count: 0, default: null },
          biometric: { required: false, keyRegistered: false, deviceAvailable: false },
          cliVersion: null,
          recent: [],
        },
        { status: httpStatus },
      );
    }
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
