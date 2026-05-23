#!/usr/bin/env node
/**
 * @purpose Generate photorealistic hero & showcase images for the LMAO landing page
 *   via visa-cli and persist them to public/landing/. Run once (or whenever brand
 *   visuals need a refresh). Costs roughly $0.04 per image at fal-flux-pro.
 *
 *   Usage:
 *     node scripts/seed-landing-images.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '..');
const OUT = join(ROOT, 'public', 'landing');

const PROMPTS = [
  {
    slug: 'hero-network',
    tool: 'fal-flux-pro',
    prompt:
      'Hyper-realistic photograph: warm dusk light pouring through floor-to-ceiling windows of a modern co-working loft. Two startup founders, mid-30s, racially diverse, laughing while one points at a glowing laptop running a terminal. Bokeh of plants, vinyl records, and neon LMAO sign in soft focus behind. Shot on 50mm f/1.4, Kodak Portra 800 film grain, cinematic color grade, no logos, no text on screens.',
  },
  {
    slug: 'agent-marketplace',
    tool: 'fal-flux-pro',
    prompt:
      'Editorial photograph for a Wired magazine feature about AI agents transacting on a marketplace. Overhead shot of a craftsman wooden desk: a sleek MacBook Pro showing a colorful card grid interface (no readable text), a Visa-style payment card resting beside a paper receipt, an open notebook with hand sketches, espresso cup, brass pen. Soft window light, photorealistic, natural shadows, 35mm.',
  },
  {
    slug: 'builders',
    tool: 'fal-flux-pro',
    prompt:
      'Photorealistic environmental portrait: a young Black female engineer wearing AirPods Max headphones, sitting on a brutalist concrete bench in front of a sunset-orange wall, holding a phone that displays a colorful gradient app interface. Shallow depth of field, golden hour lighting, Fujifilm X-T5, candid expression, no visible logos.',
  },
  {
    slug: 'collisions',
    tool: 'fal-flux-pro',
    prompt:
      'Macro photograph: two glowing magnetic spheres — one bright orange, one electric green — colliding mid-air against a pure white seamless studio background, generating a halo of light particles and motion blur tendrils. Hasselblad H6D, octa-bank lighting, ultra crisp focus on contact point, photorealistic, science museum aesthetic.',
  },
];

const CLI = process.env.VISA_CLI_PATH ?? 'visa-cli';

function runCli(args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !stdout.includes('{')) {
        return reject(new Error(`visa-cli exited ${code}: ${stderr || 'no stderr'}`));
      }
      resolve({ stdout, stderr });
    });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

function extFromMime(mime) {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'jpg';
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest = [];

  for (const item of PROMPTS) {
    console.log(`\n[seed] ${item.slug}  →  ${item.tool}`);
    const args = ['generate', 'image', '-', '--tool', item.tool, '--json', '--yes'];
    const { stdout, stderr } = await runCli(args, item.prompt);
    const line = stdout
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('{'));
    if (!line) {
      console.error(`[seed] ${item.slug} — no envelope. stderr: ${stderr.slice(0, 400)}`);
      continue;
    }
    const env = JSON.parse(line);
    if (!env.success) {
      console.error(`[seed] ${item.slug} — failed: ${env.error}`);
      continue;
    }
    const src = env.urls?.[0] ?? env.filePath;
    if (!src) {
      console.error(`[seed] ${item.slug} — no media url`);
      continue;
    }
    const res = await fetch(src.startsWith('http') ? src : `file://${src}`);
    if (!res.ok) {
      console.error(`[seed] ${item.slug} — download failed ${res.status}`);
      continue;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? env.mime ?? 'image/jpeg';
    const ext = extFromMime(mime);
    const filename = `${item.slug}.${ext}`;
    await writeFile(join(OUT, filename), bytes);
    manifest.push({
      slug: item.slug,
      file: `/landing/${filename}`,
      mime,
      bytes: bytes.length,
      tool: item.tool,
      prompt: item.prompt,
      amount: env.amount ?? null,
      transactionId: env.transactionId ?? null,
    });
    console.log(
      `[seed] ${item.slug} → /landing/${filename} (${bytes.length} bytes, $${env.amount ?? '?'})`,
    );
  }

  await writeFile(
    join(OUT, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), images: manifest }, null, 2),
  );
  console.log(`\n[seed] wrote manifest.json with ${manifest.length} images`);
}

main().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exitCode = 1;
});
