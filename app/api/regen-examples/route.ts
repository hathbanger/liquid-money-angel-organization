import { NextRequest, NextResponse } from 'next/server';
import { llmCall, extractJSON } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const motif = body?.motif;
    const motifClause = motif
      ? `\n\nMOTIF: "${motif}". All 20 briefs must be ABOUT "${motif}" — different angles, industries, scales. Still 3-8 words each. Still punchy word-cloud tags, not sentences.`
      : '';
    const res = await llmCall([{
      role: 'user',
      content: `Generate 20 provocative ideation briefs for a bisociation engine.

CRITICAL FORMAT RULE: Each brief must be 3-8 words. Like a word cloud tag. NOT a sentence. NOT a description. Just a punchy phrase.

Good examples: "shark-proof swimming pools", "edible architecture", "gym membership guilt", "dating app for enemies", "voting with your feet literally"
Bad examples: "Design a system where sharks patrol swimming pools to keep people honest" (TOO LONG)

Rules:
- Wildly different domains: tech, health, food, finance, culture, science, art, sports, cities, etc.
- Punchy, specific, surprising
- Mix of contrarian, playful, and provocative
- 3-8 words max each. Shorter is better.${motifClause}

Return ONLY a JSON array of 20 strings.`
    }], { stream: false });
    const data = await res.json();
    const text = data.choices[0].message.content;
    const briefs = extractJSON(text);
    return NextResponse.json({ briefs });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
