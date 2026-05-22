import { NextRequest, NextResponse } from 'next/server';
import { llmCall, generateImage, extractJSON } from '@/lib/llm';
import { DOMAIN_COLORS } from '@/lib/constants';

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

        // Generate domain logos in parallel via gpt-image-1
        const domainLogoPromises = domains.map((d: { domain: string }, i: number) => {
          const color = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
          return generateImage(
            `Minimalist, futuristic tech company logo mark for "${d.domain}". Abstract geometric symbol, single accent color ${color} on pure white background. No text, no letters, no words. Clean vector style like Stripe/Linear/Notion branding. Professional Series A quality. Simple, bold, iconic.`
          );
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

          // Generate idea logos in background
          const ideaLogoPromises = ideas.map((idea: { company_name: string }) =>
            generateImage(
              `Minimalist, futuristic tech startup logo for "${idea.company_name}" (inspired by ${d.domain}). Abstract geometric symbol, accent color ${accentColor} on pure white background. No text, no letters, no words. Clean vector style, professional branding. Simple, bold, iconic mark.`
            )
          );

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

        // Wait for domain logos and send them
        const domainLogos = await Promise.all(domainLogoPromises);
        controller.enqueue(encoder.encode(sseEvent({
          type: 'domain-logos',
          logos: domainLogos,
        })));

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
