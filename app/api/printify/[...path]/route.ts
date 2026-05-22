import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRINTIFY_BASE = 'https://api.printify.com';
const ALLOWED_PREFIXES = ['v1/', 'v2/'];

function buildTarget(pathSegments: string[], search: string): string | null {
  const path = pathSegments.join('/');
  if (!ALLOWED_PREFIXES.some(p => path.startsWith(p))) return null;
  return `${PRINTIFY_BASE}/${path}${search}`;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'PRINTIFY_API_TOKEN not configured' },
      { status: 500 },
    );
  }

  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = buildTarget(path, url.search);
  if (!target) {
    return NextResponse.json(
      { error: `path must start with one of: ${ALLOWED_PREFIXES.join(', ')}` },
      { status: 400 },
    );
  }

  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    'User-Agent': process.env.PRINTIFY_USER_AGENT ?? 'lmao-merch/1.0',
    Accept: 'application/json',
  });

  const incomingContentType = req.headers.get('content-type');
  if (incomingContentType) headers.set('Content-Type', incomingContentType);

  const methodHasBody = !['GET', 'HEAD'].includes(req.method);
  const init: RequestInit = {
    method: req.method,
    headers,
    body: methodHasBody ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  };

  const upstream = await fetch(target, init);

  const resHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) resHeaders.set('content-type', contentType);
  const rateRemaining = upstream.headers.get('x-ratelimit-remaining');
  const rateLimit = upstream.headers.get('x-ratelimit-limit');
  if (rateRemaining) resHeaders.set('x-ratelimit-remaining', rateRemaining);
  if (rateLimit) resHeaders.set('x-ratelimit-limit', rateLimit);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
