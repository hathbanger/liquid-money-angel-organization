/**
 * @purpose Curated abstract SVG glyphs used as domain icons on the results view.
 *   Each glyph is geometric, scales to fit a square, and draws in currentColor so
 *   the parent's color cascade controls its tint. `iconForDomain(name)` is
 *   deterministic so the same domain always maps to the same glyph.
 */
import React from "react";

type IconRenderer = (props: { size?: number }) => React.ReactElement;

const baseSvg = (children: React.ReactNode, size = 48) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const DOMAIN_ICONS: IconRenderer[] = [
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="24" cy="24" r="14" />
        <ellipse cx="24" cy="24" rx="20" ry="6" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <polygon points="24,4 44,18 36,42 12,42 4,18" />
        <polygon points="24,14 34,21 30,33 18,33 14,21" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 24c6-12 30-12 36 0" />
        <path d="M6 24c6 12 30 12 36 0" />
        <circle cx="24" cy="24" r="3" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <rect x="6" y="6" width="36" height="36" />
        <path d="M6 18h36M6 30h36M18 6v36M30 6v36" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="24" cy="24" r="18" />
        <circle cx="24" cy="24" r="12" />
        <circle cx="24" cy="24" r="6" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M4 36 L20 12 L28 30 L44 6" />
        <circle cx="44" cy="6" r="2" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M24 4 L24 44 M8 12 L40 36 M8 36 L40 12" />
        <circle cx="24" cy="24" r="4" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M8 24a16 16 0 0 1 32 0" />
        <path d="M14 24a10 10 0 0 1 20 0" />
        <path d="M20 24a4 4 0 0 1 8 0" />
        <path d="M24 24v18" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <polygon points="24,4 44,38 4,38" />
        <polygon points="24,14 36,34 12,34" />
        <circle cx="24" cy="30" r="2" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 14h36 M6 24h36 M6 34h36" />
        <circle cx="14" cy="14" r="3" fill="currentColor" stroke="none" />
        <circle cx="34" cy="24" r="3" fill="currentColor" stroke="none" />
        <circle cx="22" cy="34" r="3" fill="currentColor" stroke="none" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z" />
        <path d="M24 4 L24 24 M24 24 L42 14 M24 24 L42 34 M24 24 L6 34 M24 24 L6 14 M24 24 L24 44" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 42 Q12 18 24 18 Q36 18 42 42" />
        <circle cx="24" cy="12" r="6" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M8 8 L40 8 L24 40 Z" />
        <path d="M16 14 L32 14 L24 32 Z" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="14" cy="24" r="8" />
        <circle cx="34" cy="24" r="8" />
        <circle cx="24" cy="12" r="8" />
        <circle cx="24" cy="36" r="8" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 24h36" />
        <path d="M12 16l-6 8 6 8" />
        <path d="M36 16l6 8-6 8" />
        <path d="M24 8v32" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="24" cy="24" r="18" />
        <path d="M24 6 L24 42 M6 24 L42 24 M11 11 L37 37 M37 11 L11 37" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <rect x="10" y="10" width="28" height="28" transform="rotate(45 24 24)" />
        <rect x="16" y="16" width="16" height="16" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 38 Q14 22 24 22 Q34 22 42 38" />
        <path d="M6 30 Q14 14 24 14 Q34 14 42 30" />
        <path d="M6 22 Q14 6 24 6 Q34 6 42 22" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="24" cy="24" r="16" />
        <path d="M24 8 Q34 18 24 24 Q14 30 24 40" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M24 6 L24 42" />
        <path d="M24 12 L12 4 M24 12 L36 4" />
        <path d="M24 24 L8 18 M24 24 L40 18" />
        <path d="M24 36 L12 30 M24 36 L36 30" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <polygon points="24,6 38,16 38,32 24,42 10,32 10,16" />
        <polygon points="24,16 32,21 32,29 24,34 16,29 16,21" />
        <circle cx="24" cy="25" r="2" fill="currentColor" stroke="none" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M6 24c0 0 4-12 18-12s18 12 18 12-4 12-18 12S6 24 6 24z" />
        <circle cx="24" cy="24" r="5" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <path d="M8 40 L8 8 L40 40" />
        <path d="M8 24 L24 40" />
        <path d="M16 16 L40 40" />
      </>,
      size,
    ),
  ({ size }) =>
    baseSvg(
      <>
        <circle cx="14" cy="14" r="6" />
        <circle cx="34" cy="14" r="6" />
        <circle cx="14" cy="34" r="6" />
        <circle cx="34" cy="34" r="6" />
        <path d="M14 14 L34 34 M34 14 L14 34" />
      </>,
      size,
    ),
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function iconForDomain(domain: string): IconRenderer {
  if (!domain) return DOMAIN_ICONS[0];
  return DOMAIN_ICONS[hash(domain.toLowerCase()) % DOMAIN_ICONS.length];
}

export function DomainIcon({ domain, size = 48 }: { domain: string; size?: number }) {
  const Icon = iconForDomain(domain);
  return <Icon size={size} />;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function collisionSlug(brief: string, companyName: string): string {
  const base = slugify(companyName || "untitled");
  const fp = hash(`${brief.toLowerCase()}|${companyName.toLowerCase()}`)
    .toString(36)
    .slice(0, 6);
  return `${base}-${fp}`;
}
