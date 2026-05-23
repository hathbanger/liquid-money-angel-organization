/**
 * @purpose Client-side persistence for collision data so /c/[slug] pages can
 *   hydrate without re-running the LLM. Keyed by collisionSlug(brief, company).
 *   Stored under localStorage key `lmao:collisions:v1` as a JSON map.
 */

import type { Palette } from "./palettes";

export interface StoredCollision {
  slug: string;
  brief: string;
  company_name: string;
  tagline: string;
  mechanism: string;
  attribution: string;
  domain: string;
  domain_principle: string;
  domain_question: string;
  domainColor: string;
  domainLogo: string | null;
  ideaLogo: string | null;
  palette: Palette | null;
  theme: "light" | "dark";
  createdAt: number;
  merch?: Record<string, string>;
}

const KEY = "lmao:collisions:v1";

function readAll(): Record<string, StoredCollision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredCollision>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredCollision>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota or disabled — silently drop */
  }
}

export function saveCollision(c: StoredCollision): void {
  const all = readAll();
  all[c.slug] = c;
  writeAll(all);
}

export function loadCollision(slug: string): StoredCollision | null {
  const all = readAll();
  return all[slug] ?? null;
}

export function patchCollision(slug: string, patch: Partial<StoredCollision>): void {
  const all = readAll();
  if (!all[slug]) return;
  all[slug] = { ...all[slug], ...patch };
  writeAll(all);
}

export function listCollisions(limit?: number): StoredCollision[] {
  const all = readAll();
  const sorted = Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}
