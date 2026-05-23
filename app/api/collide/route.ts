import { NextRequest, NextResponse } from 'next/server';
import { llmCall, generateImage, extractJSON } from '@/lib/llm';
import { generateDomainLogo } from '@/lib/generate-logo';
import { DOMAIN_COLORS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { brief } = await request.json();
  if (!brief || !brief.trim()) {
    return NextResponse.json({ error: 'Brief is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseEvent({ type: 'status', message: 'Generating distant domains...' })));

        const domainPrompt = `You are a bisociation engine. Given an ideation brief, generate 4 structurally distant knowledge domains that have NOTHING obvious to do with the brief's field. Each domain must include:
1. Domain name (e.g. "fungal mycelium networks", "Ottoman tax farming", "semiconductor doping")
2. An active principle — a specific counter-intuitive mechanism from that domain
3. A bridging question — how might this principle apply to the brief?

Rules:
- Domains must be from DIFFERENT fields (biology, physics, history, economics, manufacturing, etc.)
- The more counter-intuitive the connection, the better
- Avoid cliché metaphors (no "ecosystem", no "DNA of the company")
- Each active principle must be a real, specific mechanism — not a vague analogy

Brief: ${brief}

Return ONLY a JSON array: [{"domain": "...", "active_principle": "...", "bridging_question": "..."}]`;

        const domainRes = await llmCall([{ role: 'user', content: domainPrompt }]);
        const domainData = await domainRes.json();
        const domainText = domainData.choices[0].message.content;
        const domains = extractJSON(domainText);

        controller.enqueue(encoder.encode(sseEvent({ type: 'domains', domains })));

        const domainLogoPromises = domains.map((d: { domain: string }, i: number) =>
          generateDomainLogo(d.domain, DOMAIN_COLORS[i % DOMAIN_COLORS.length])
        );

        Promise.all(domainLogoPromises).then((logos) => {
          try {
            controller.enqueue(encoder.encode(sseEvent({
              type: 'domain-logos',
              logos,
            })));
          } catch { /* stream may have closed */ }
        });

        // Phase 2: Collide each domain
        const ideaLogoFlushers: Promise<void>[] = [];
        for (let i = 0; i < domains.length; i++) {
          const d = domains[i];
          const accentColor = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
          controller.enqueue(encoder.encode(sseEvent({ type: 'status', message: `Colliding: ${d.domain}...` })));

          const collisionPrompt = `You are generating startup ideas through bisociation — colliding a distant domain with a problem brief.

Brief: ${brief}
Distant Domain: ${d.domain}
Active Principle: ${d.active_principle}
Bridging Question: ${d.bridging_question}

Generate 2 non-trivial startup ideas that could ONLY exist because of this collision. Each idea must have:
1. "company_name" — a short, punchy, brandable startup name (1-2 words, like "Stripe", "Notion", "Vercel", "Runway"). Must sound like a real tech company.
2. "tagline" — a 3-8 word product tagline
3. "mechanism" — how the active principle transfers (1-2 sentences, concrete, not metaphorical)
4. "attribution" — "↳ from ${d.domain}"

Return ONLY a JSON array: [{"company_name": "...", "tagline": "...", "mechanism": "...", "attribution": "..."}]`;

          const collisionRes = await llmCall([{ role: 'user', content: collisionPrompt }]);
          const collisionData = await collisionRes.json();
          const collisionText = collisionData.choices[0].message.content;
          const ideas = extractJSON(collisionText);

          controller.enqueue(encoder.encode(sseEvent({
            type: 'collision',
            domainIndex: i,
            domain: d.domain,
            ideas,
            accentColor,
          })));

          // Generate idea logos in background.
          // Prompt is *content-grounded*: each idea's logo is built from its
          // mechanism + tagline, not just the name. A "bankruptcy livestream"
          // company should read visually like media/finance, not generic
          // abstract shapes. The source domain ("${d.domain}") seeds the
          // visual vocabulary (geological, biological, mechanical, etc.).
          const ideaLogoPromises = ideas.map((idea: { company_name: string; tagline?: string; mechanism?: string }) => {
            const promptParts = [
              `Minimalist Series-A startup logo mark for "${idea.company_name}".`,
              idea.mechanism ? `What the company does: ${idea.mechanism}` : '',
              idea.tagline ? `Tagline: ${idea.tagline}` : '',
              `Inspired by the domain of "${d.domain}" — let that subject matter shape the visual vocabulary.`,
              `Abstract geometric symbol. Single accent color ${accentColor} on pure white background.`,
              `No text, no letters, no words in the image — pure mark.`,
              `Style references: Stripe, Linear, Notion, Vercel. Clean vector, bold, iconic.`,
              `Composition: centered, generous white margin, square format.`,
            ].filter(Boolean).join(' ');
            return generateImage(promptParts);
          });

          const flusher = Promise.all(ideaLogoPromises).then(async (logos) => {
            try {
              controller.enqueue(encoder.encode(sseEvent({
                type: 'idea-logos',
                domainIndex: i,
                logos,
              })));
            } catch { /* stream may have closed */ }
          });
          ideaLogoFlushers.push(flusher);
        }

        await Promise.allSettled(domainLogoPromises);

        // Wait for all idea logos to flush
        await Promise.allSettled(ideaLogoFlushers);

        controller.enqueue(encoder.encode(sseEvent({ type: 'done' })));
      } catch (err: unknown) {
        console.error('Collide error:', err);
        controller.enqueue(encoder.encode(sseEvent({ type: 'error', message: (err as Error).message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
