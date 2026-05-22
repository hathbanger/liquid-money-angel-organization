/**
 * @purpose POST /api/company-merch
 *
 * Generates a full merch line (6 pieces) where each product has its OWN
 * creative concept — not just "logo centered." The goal is that someone
 * looking at the tee for a "company that feeds you allergens" sees a
 * deliberate, brand-voicy joke, not a generic logo print.
 *
 * Two phases:
 *   1. ONE LLM call → 6 product concepts (shape, creative name, blurb,
 *      print concept, image-gen prompt). Concepts are tuned to the
 *      product's surface (tee = bold statement, mug = inside joke, etc.)
 *   2. PARALLEL image gens (one per product) using each product's
 *      individually-crafted prompt.
 *
 * The caller (/c/[slug]/page.tsx) caches the response in localStorage by
 * slug so we don't re-burn $$$ on every page view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MODEL, BASE_URL } from '@/lib/constants';
import { generateLogoFromPrompt } from '@/lib/generate-logo';
import { buildMockup } from '@/lib/printify-mockup';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface MerchRequest {
  slug?: string;
  company_name?: string;
  tagline?: string;
  mechanism?: string;
  attribution?: string;
  accent?: string;
  domain?: string;
}

interface MerchConcept {
  shape: 'tee' | 'hoodie' | 'mug' | 'sticker' | 'tote' | 'poster';
  name: string;
  price: number;
  blurb: string;
  print_concept: string;
  print_prompt: string;
}

interface MerchProduct extends MerchConcept {
  id: string;
  /** The LLM-prompted print artwork (PNG URL after persist-media). */
  print_url: string | null;
  /** The Printify-rendered product photo with the print applied.
   *  null = Printify not configured (no PRINTIFY_API_TOKEN), or the
   *  pipeline failed for this product (the page falls back to the SVG
   *  mockup with the print overlay). */
  mockup_url: string | null;
  /** Created Printify product id — useful for later "Buy this company"
   *  flows that route through Printify checkout. */
  printify_product_id?: string | null;
  /** Short reason when mockup_url is null (for the loading-status pane). */
  mockup_error?: string;
}

const MERCH_LLM_PROMPT = (input: Required<Pick<MerchRequest, 'company_name' | 'tagline' | 'mechanism' | 'accent'>> & { domain: string }) => `You are the creative director designing the merch line for "${input.company_name}", a company whose mechanism is:

  ${input.mechanism}

Tagline: ${input.tagline}
Source-domain inspiration: ${input.domain}
Brand accent color: ${input.accent}

Design 6 pieces of merch (tee, hoodie, mug, sticker, tote, poster). Each piece must have its OWN creative concept that captures the brand's specific tone and the SPECIFIC absurdity, insight, or value of what the company does — not generic "startup merch."

THE LINE MUST FEEL LIKE THE COMPANY ITSELF DESIGNED IT. If the company is irreverent, the merch is irreverent. If the company is refined, the merch is refined. If the company is darkly funny, the merch leans into the dark joke. NEVER just "logo centered on a tee."

Each product surface implies a voice:
- TEE: a bold statement, slogan, manifesto line, or typographic graphic — the thing people see across a room
- HOODIE: subculture identity, back-print energy, "you'd recognize me in this" tribal feel
- MUG: an inside joke for the user — quiet, daily, often a pun or one-liner that lands in private
- STICKER: a punchy badge, single icon, or short phrase — laptop-lid identity, fits in 3 inches
- TOTE: a lifestyle quote, hand-drawn-feeling typography, or single graphic that reads on the subway
- POSTER: full-art, manifesto vibe, possibly informational/diagrammatic, the wall piece

Return ONE JSON object exactly in this shape, no markdown, no commentary:

{
  "products": [
    {
      "shape": "tee",
      "name": "<creative product name, 2-4 words, matches the company's voice, NOT generic 'Manifesto Tee'>",
      "price": <integer USD: tee 32-40, hoodie 68-85, mug 18-24, sticker pack 8-12, tote 24-32, poster 20-30>,
      "blurb": "<25-40 word product blurb written IN THE COMPANY'S VOICE, not marketing-speak>",
      "print_concept": "<one sentence describing what's printed on the surface — slogan + visual treatment>",
      "print_prompt": "<detailed image-generation prompt for the print artwork. Composition: centered, suitable for screen printing on the product surface. Colors: anchored on ${input.accent}, on transparent or white background as appropriate. Style references: pick one that fits — Patagonia, Supreme, Hatch Show Print, Ralph Steadman, Saul Bass, Mucinex-era pharma ads, etc. Specify NO LETTERS in the image (text will be added by Printify if needed) OR include hand-lettered words as part of the image — choose explicitly. Square format, 1024x1024.>"
    },
    { "shape": "hoodie", ... },
    { "shape": "mug", ... },
    { "shape": "sticker", ... },
    { "shape": "tote", ... },
    { "shape": "poster", ... }
  ]
}

Hard rules:
- EXACTLY 6 products, one per shape, in this order: tee, hoodie, mug, sticker, tote, poster.
- Each "print_concept" must be uniquely tied to ${input.mechanism}. No repeating concepts across products.
- No emojis except where the print_concept explicitly calls for one.
- No double quotes inside string values — use single quotes or rephrase.
- Return ONLY the JSON object. No markdown fences, no preamble.`;

function extractJSONObject(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/gm, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('No JSON object in LLM response');
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON object in LLM response');
}

async function generateMerchConcepts(
  input: Required<Pick<MerchRequest, 'company_name' | 'tagline' | 'mechanism' | 'accent'>> & { domain: string },
): Promise<MerchConcept[]> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://open-collider-poc.fly.dev',
      'X-Title': 'LMAO Merch Concept Director',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: MERCH_LLM_PROMPT(input) }],
      temperature: 1.0,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Merch concept LLM ${res.status}: ${text}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJSONObject(raw) as { products?: MerchConcept[] };
  if (!Array.isArray(parsed.products) || parsed.products.length !== 6) {
    throw new Error(`Expected 6 product concepts, got ${parsed.products?.length}`);
  }
  return parsed.products;
}

export async function POST(req: NextRequest) {
  let body: MerchRequest;
  try {
    body = (await req.json()) as MerchRequest;
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const company_name = body.company_name?.trim();
  const tagline = body.tagline?.trim();
  const mechanism = body.mechanism?.trim();
  const accent = body.accent?.trim();
  const domain = body.domain?.trim() ?? '';
  const slug = body.slug?.trim();
  if (!company_name || !tagline || !mechanism || !accent || !slug) {
    return NextResponse.json({
      error: 'slug, company_name, tagline, mechanism, accent are required',
    }, { status: 400 });
  }

  // Detect whether Printify is configured. If not, we still ship the LLM-
  // generated print artwork on the SVG mockup, but skip the real-photo step.
  const printifyEnabled = !!process.env.PRINTIFY_API_TOKEN;

  try {
    // Phase 1: LLM concepts (~5-10s)
    const concepts = await generateMerchConcepts({ company_name, tagline, mechanism, accent, domain });

    // Phase 2: parallel image gens for the print artwork (longest pole among
    // the image gens). Each can independently fail without blocking the
    // others — the page handles `print_url: null` by falling back to the
    // SVG initials placeholder for that single product.
    const productsWithPrints: MerchProduct[] = await Promise.all(
      concepts.map(async (concept) => {
        const print_url = await generateLogoFromPrompt(concept.print_prompt, `merch:${concept.shape}`)
          .catch((err) => {
            console.error(`merch image gen failed for ${concept.shape}:`, err);
            return null;
          });
        return {
          ...concept,
          id: concept.shape, // shape doubles as id since each shape is unique
          print_url,
          mockup_url: null,
        };
      }),
    );

    // Phase 3: Printify mockups. Skipped entirely when PRINTIFY_API_TOKEN is
    // absent (development without a Printify account); also skipped per-
    // product when the print artwork didn't generate. Each Printify call is
    // 4-5 sequential API hits (~5-15s); we parallelize across products.
    if (printifyEnabled) {
      await Promise.all(
        productsWithPrints.map(async (p) => {
          if (!p.print_url) return; // no artwork → no mockup
          const result = await buildMockup({
            shape: p.shape,
            printUrl: p.print_url,
            companyName: company_name,
            productName: p.name,
            productBlurb: p.blurb,
          });
          p.mockup_url = result.mockupUrl;
          p.printify_product_id = result.productId;
          if (result.error) p.mockup_error = result.error;
        }),
      );
    }

    return NextResponse.json({
      slug,
      products: productsWithPrints,
      printify_enabled: printifyEnabled,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `merch generation failed: ${msg}` }, { status: 500 });
  }
}
