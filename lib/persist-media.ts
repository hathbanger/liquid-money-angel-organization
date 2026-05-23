/** @purpose Download transient visa-cli media URLs and persist to durable local storage. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VisaEnvelope } from './visa-cli';

export type PersistResult = {
  id: string;
  url: string;
  mime: string;
  bytes: number;
  sourceUrl: string;
};

export async function persistFromEnvelope(
  envelope: VisaEnvelope,
  meta: { kind: string; prompt?: string; tool?: string },
): Promise<PersistResult> {
  const sourceUrl = envelope.urls?.[0] ?? envelope.filePath;
  if (!sourceUrl) {
    throw new Error('nothing to persist — no urls or filePath');
  }

  const fetchUrl = sourceUrl.startsWith('http') ? sourceUrl : `file://${sourceUrl}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? guessMime(meta.kind);
  const ext = extFromMime(mime);
  const id = randomUUID();

  const dir = join(process.cwd(), 'public', 'generated', meta.kind);
  await mkdir(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  await writeFile(join(dir, filename), bytes);

  return {
    id,
    url: `/generated/${meta.kind}/${filename}`,
    mime,
    bytes: bytes.length,
    sourceUrl,
  };
}

function guessMime(kind: string) {
  if (kind === 'music' || kind === 'speech') return 'audio/mpeg';
  if (kind === 'video') return 'video/mp4';
  if (kind === '3d') return 'model/gltf-binary';
  return 'image/jpeg';
}

function extFromMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('gltf')) return 'glb';
  return 'jpg';
}
