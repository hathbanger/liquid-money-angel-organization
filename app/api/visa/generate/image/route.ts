/** @purpose POST handler — visa-cli image generation with durable local persistence. */
import { NextResponse } from 'next/server';
import { generateImage, VisaCliError } from '@/lib/visa-cli';
import { persistFromEnvelope } from '@/lib/persist-media';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Body = {
  prompt: string;
  tool?: string;
  fast?: boolean;
  quality?: 'standard' | 'high';
  imageRef?: string;
  persist?: boolean;
  kind?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  }
  if (body.prompt.length > 8000) {
    return NextResponse.json({ error: 'prompt too long' }, { status: 400 });
  }

  try {
    const envelope = await generateImage(body);

    if (body.persist !== false && (envelope.urls?.length || envelope.filePath)) {
      const stored = await persistFromEnvelope(envelope, {
        kind: body.kind ?? 'image',
        prompt: body.prompt,
        tool: body.tool,
      });
      return NextResponse.json({
        success: true,
        command: envelope.command,
        amount: envelope.amount,
        transactionId: envelope.transactionId,
        url: stored.url,
        id: stored.id,
        mime: stored.mime,
        bytes: stored.bytes,
      });
    }

    return NextResponse.json({
      success: true,
      command: envelope.command,
      amount: envelope.amount,
      transactionId: envelope.transactionId,
      urls: envelope.urls,
      filePath: envelope.filePath,
    });
  } catch (err) {
    if (err instanceof VisaCliError) {
      const status =
        err.code === 'TIMEOUT' ? 504 :
        err.code === 'NOT_FOUND' ? 503 :
        502;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
