import { MODEL, BASE_URL } from './constants';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function llmCall(
  messages: { role: string; content: string }[],
  { stream = false, model = MODEL }: { stream?: boolean; model?: string } = {}
) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://open-collider-poc.fly.dev',
      'X-Title': 'Open Collider POC',
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      temperature: 1,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  return res;
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`OpenAI image error ${res.status}: ${text}`);
      return null;
    }
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    const url = data.data?.[0]?.url;
    return url || null;
  } catch (e: unknown) {
    console.error('Image gen failed:', (e as Error).message);
    return null;
  }
}

export function extractJSON(text: string) {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  throw new Error('No JSON array found in response');
}
