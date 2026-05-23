/**
 * @purpose POST /api/idea-logo
 *
 * Generates a real, content-grounded logo for a single idea (company).
 * The prompt is built from the company's mechanism + tagline, NOT just the
 * name — so a "bankruptcy livestream" company gets a logo that reads like
 * media/finance, not generic abstract shapes.
 *
 * Returns the persisted image URL. Server-side only — the marketplace
 * page lazy-loads from here per visible idea.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateLogoFromPrompt } from '@/lib/generate-logo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface IdeaLogoRequest {
  company_name?: string;
  tagline?: string;
  mechanism?: string;
  accent?: string;
  /** Optional: domain context, used to ground the visual vocabulary */
  domain?: string;
}

function logoPromptFor(input: Required<Pick<IdeaLogoRequest, 'company_name' | 'tagline' | 'mechanism' | 'accent'>> & { domain: string }) {
  return [
    `Minimalist Series-A startup logo mark for "${input.company_name}".`,
    `What the company does: ${input.mechanism}`,
    `Tagline: ${input.tagline}`,
    input.domain ? `Inspired by the domain of "${input.domain}" — let that subject matter shape the visual vocabulary (geological, biological, mechanical, etc., as fits).` : '',
    `Abstract geometric symbol. Single accent color ${input.accent} on pure white background.`,
    `No text, no letters, no words, no taglines in the image — pure mark.`,
    `Style references: Stripe, Linear, Notion, Vercel. Clean vector, bold, iconic.`,
    `Composition: centered, generous white margin, square format.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function POST(req: NextRequest) {
  let body: IdeaLogoRequest;
  try {
    body = (await req.json()) as IdeaLogoRequest;
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const company_name = body.company_name?.trim();
  const tagline = body.tagline?.trim();
  const mechanism = body.mechanism?.trim();
  const accent = body.accent?.trim();
  const domain = body.domain?.trim() ?? '';
  if (!company_name || !tagline || !mechanism || !accent) {
    return NextResponse.json({
      error: 'company_name, tagline, mechanism, accent are required',
    }, { status: 400 });
  }

  const prompt = logoPromptFor({ company_name, tagline, mechanism, accent, domain });

  try {
    const url = await generateLogoFromPrompt(prompt, 'idea-logo');
    if (!url) {
      return NextResponse.json({ error: 'logo generation returned no URL' }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `logo generation failed: ${msg}` }, { status: 500 });
  }
}
