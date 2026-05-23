/** @purpose Generate and persist domain/idea logo marks via visa-cli image generation. */
import { generateImage, VisaCliError } from './visa-cli';
import { persistFromEnvelope } from './persist-media';

const DOMAIN_LOGO_TOOL = process.env.DOMAIN_LOGO_TOOL ?? 'fal-recraft-v3';
const DOMAIN_LOGO_FAST = process.env.DOMAIN_LOGO_FAST === 'true';

function domainLogoPrompt(domain: string, color: string) {
  return `Minimalist, futuristic tech company logo mark for "${domain}". Abstract geometric symbol, single accent color ${color} on pure white background. No text, no letters, no words. Clean vector style like Stripe/Linear/Notion branding. Professional Series A quality. Simple, bold, iconic.`;
}

export async function generateDomainLogo(domain: string, color: string): Promise<string | null> {
  const prompt = domainLogoPrompt(domain, color);

  try {
    const envelope = await generateImage({
      prompt,
      tool: DOMAIN_LOGO_FAST ? undefined : DOMAIN_LOGO_TOOL,
      fast: DOMAIN_LOGO_FAST,
    });

    if (!envelope.urls?.length && !envelope.filePath) return null;

    const stored = await persistFromEnvelope(envelope, {
      kind: 'domain-logo',
      prompt,
      tool: DOMAIN_LOGO_FAST ? 'fast' : DOMAIN_LOGO_TOOL,
    });

    console.info('[visa-cli] domain-logo', {
      domain,
      amount: envelope.amount,
      transactionId: envelope.transactionId,
      url: stored.url,
    });

    return stored.url;
  } catch (err) {
    if (err instanceof VisaCliError) {
      console.error('[visa-cli] domain-logo failed:', err.code, err.message);
    } else {
      console.error('[visa-cli] domain-logo failed:', (err as Error).message);
    }
    return null;
  }
}

export async function generateLogoFromPrompt(
  prompt: string,
  kind: string,
  opts?: { tool?: string; fast?: boolean },
): Promise<string | null> {
  try {
    const envelope = await generateImage({
      prompt,
      tool: opts?.tool,
      fast: opts?.fast,
    });

    if (!envelope.urls?.length && !envelope.filePath) return null;

    const stored = await persistFromEnvelope(envelope, {
      kind,
      prompt,
      tool: opts?.tool,
    });

    console.info('[visa-cli] logo', {
      kind,
      amount: envelope.amount,
      transactionId: envelope.transactionId,
      url: stored.url,
    });

    return stored.url;
  } catch (err) {
    if (err instanceof VisaCliError) {
      console.error(`[visa-cli] ${kind} failed:`, err.code, err.message);
    } else {
      console.error(`[visa-cli] ${kind} failed:`, (err as Error).message);
    }
    return null;
  }
}
