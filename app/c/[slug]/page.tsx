"use client";

/**
 * @purpose Collision landing page. Hydrates a single saved collision from
 *   localStorage and renders it as a full-bleed, palette-themed startup site
 *   with hero, mechanism, origin story, merch store, and footer.
 */

import { useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import { use } from "react";
import Link from "next/link";
import {
  loadCollision,
  patchCollision,
  type StoredCollision,
} from "@/lib/collision-store";
import { DomainIcon } from "@/lib/domain-icons";
import { IdeaIcon, getIdeaIconPaths } from "@/lib/idea-icons";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ProductShape = "tee" | "hoodie" | "mug" | "sticker" | "tote" | "poster";

interface Product {
  id: string;
  name: string;
  price: number;
  blurb: string;
  shape: ProductShape;
  /** Generated print artwork URL — null until LLM + image gen finishes. */
  printUrl?: string | null;
  /** Real Printify product photo with the print applied. When present this
   *  is rendered instead of the SVG mockup. */
  mockupUrl?: string | null;
  /** LLM's one-line creative concept (shown as caption / tooltip). */
  printConcept?: string;
}

// Generic placeholder line — used while the company-specific merch
// concepts are still being generated, AND as a fallback if the
// generation request fails entirely.
const FALLBACK_PRODUCTS: Product[] = [
  { id: "tee", name: "Manifesto Tee", price: 34, blurb: "Heavyweight 100% cotton. Front print, neck-label collision date.", shape: "tee" },
  { id: "hoodie", name: "Field Hoodie", price: 78, blurb: "Brushed fleece, drop shoulder. The piece you ship in.", shape: "hoodie" },
  { id: "mug", name: "Mechanism Mug", price: 22, blurb: "14oz stoneware. For coffee, ideas, and 6am demos.", shape: "mug" },
  { id: "sticker", name: "Stickers (×6)", price: 9, blurb: "Vinyl, weatherproof. Laptop lid, water bottle, gym locker.", shape: "sticker" },
  { id: "tote", name: "Origin Tote", price: 28, blurb: "Heavy canvas, gusseted. Holds two laptops and a manifesto.", shape: "tote" },
  { id: "poster", name: "Field Poster 18×24", price: 24, blurb: "Matte fine-art print. Mechanism diagram included.", shape: "poster" },
];

const MERCH_CACHE_KEY = "lmao:merch:v1";

interface MerchCacheEntry {
  products: Product[];
  generated_at: number;
}

function loadMerchCache(slug: string): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MERCH_CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, MerchCacheEntry>;
    return all[slug]?.products ?? null;
  } catch {
    return null;
  }
}

function saveMerchCache(slug: string, products: Product[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MERCH_CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, MerchCacheEntry>) : {};
    all[slug] = { products, generated_at: Date.now() };
    window.localStorage.setItem(MERCH_CACHE_KEY, JSON.stringify(all));
  } catch {
    /* quota / disabled — drop silently */
  }
}

type BuyState = 'idle' | 'paying' | 'paid' | 'error';

interface BuyReceipt {
  transaction?: string;
  network?: string;
  payer?: string;
}

export default function CollisionPage({ params }: PageProps) {
  const { slug } = use(params);
  const [collision, setCollision] = useState<StoredCollision | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [buyState, setBuyState] = useState<Record<string, BuyState>>({});
  /**
   * Merch products — starts as FALLBACK_PRODUCTS (generic placeholders),
   * upgrades to LLM-generated company-specific concepts after /api/company-merch
   * resolves. Cached per slug in localStorage so re-visits skip the regen.
   */
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [merchLoading, setMerchLoading] = useState(false);
  const [merchError, setMerchError] = useState<string | null>(null);

  useEffect(() => {
    setCollision(loadCollision(slug));
    setHydrated(true);
  }, [slug]);

  // Lazy merch generation. Fires once we have the collision in hand. Cache
  // is checked first; if cold, we hit /api/company-merch (which is the
  // long-pole — 1 LLM call + 6 parallel image gens, ~30-60s).
  useEffect(() => {
    if (!collision) return;
    const cached = loadMerchCache(slug);
    if (cached && cached.length === 6) {
      setProducts(cached);
      return;
    }
    let aborted = false;
    setMerchLoading(true);
    setMerchError(null);
    (async () => {
      try {
        const res = await fetch("/api/company-merch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            company_name: collision.company_name,
            tagline: collision.tagline,
            mechanism: collision.mechanism,
            attribution: collision.attribution,
            accent: collision.domainColor,
            domain: collision.domain,
          }),
        });
        if (aborted) return;
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.products)) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        // API uses snake_case (print_url, mockup_url, print_concept) to stay
        // shell-friendly; the UI types are camelCase. Map at the boundary.
        interface ApiProduct {
          shape: ProductShape;
          name: string;
          price: number;
          blurb: string;
          print_url: string | null;
          mockup_url: string | null;
          print_concept: string;
        }
        const mapped: Product[] = (data.products as ApiProduct[]).map((p) => ({
          id: p.shape,
          shape: p.shape,
          name: p.name,
          price: p.price,
          blurb: p.blurb,
          printUrl: p.print_url,
          mockupUrl: p.mockup_url,
          printConcept: p.print_concept,
        }));
        setProducts(mapped);
        saveMerchCache(slug, mapped);
      } catch (err) {
        if (aborted) return;
        setMerchError(err instanceof Error ? err.message : String(err));
        // Leave the fallback products in place so the page still has merch
        // to show; the error is surfaced via a small notice in the store.
      } finally {
        if (!aborted) setMerchLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [collision, slug]);

  const variant = useMemo(() => {
    if (!collision?.palette) return null;
    return collision.theme === "dark"
      ? collision.palette.dark
      : collision.palette.light;
  }, [collision]);

  const pageStyle: CSSProperties = useMemo(() => {
    if (!collision) return {};
    const main = variant?.main ?? collision.domainColor;
    const hover = variant?.hover ?? collision.domainColor;
    const soft = variant?.soft ?? "rgba(0,0,0,0.05)";
    return {
      "--accent": main,
      "--accent-hover": hover,
      "--accent-soft": soft,
      "--domain-color": collision.domainColor,
    } as CSSProperties;
  }, [collision, variant]);

  function showToast(msg: string, durationMs = 2600): void {
    setToast(msg);
    window.setTimeout(() => setToast(null), durationMs);
  }

  /**
   * Real x402 purchase. POSTs to /api/buy, which spawns the server-side x402
   * v2 buyer (EVM signer + ExactEvmScheme) and pays the seller's 402-protected
   * endpoint. On success we still bump the local cart counter so the existing
   * UI affordance keeps working — the user sees the same "added" feeling, but
   * the backing event is a real on-chain settlement on Base Sepolia.
   *
   * The seller URL is derived server-side from X402_SELLER_URL_BASE so the
   * client never has to know about the wallet, network, or merchant URL.
   */
  async function buyProduct(id: string, name: string, price: number): Promise<void> {
    if (buyState[id] === 'paying') return;
    setBuyState((s) => ({ ...s, [id]: 'paying' }));
    showToast(`Paying $${price} for ${name}…`, 8000);
    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, shape: id, quantity: 1 }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        configured?: boolean;
        upstreamStatus?: number;
        hint?: string;
        settle?: BuyReceipt | null;
      };
      if (!res.ok || !data.ok) {
        setBuyState((s) => ({ ...s, [id]: 'error' }));
        const msg = data.error
          ? data.code === 'MISSING_KEY' || data.code === 'MISSING_SELLER'
            ? 'x402 not configured — set EVM_PRIVATE_KEY and X402_SELLER_URL_BASE'
            : `Purchase failed: ${data.error}`
          : `Purchase failed (HTTP ${res.status})`;
        showToast(msg, 5000);
        return;
      }
      setBuyState((s) => ({ ...s, [id]: 'paid' }));
      setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
      const tx = data.settle?.transaction;
      const short = tx ? `${tx.slice(0, 6)}…${tx.slice(-4)}` : 'settled';
      showToast(`Bought ${name} · ${short}`, 4500);
    } catch (err) {
      setBuyState((s) => ({ ...s, [id]: 'error' }));
      showToast(`Purchase failed: ${(err as Error).message}`, 5000);
    }
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  if (!hydrated) {
    return (
      <div className="c-loading">
        <div className="c-loading-dot" />
      </div>
    );
  }

  if (!collision) {
    return (
      <div className="c-missing">
        <div className="c-missing-inner">
          <div className="c-missing-title">Collision not found</div>
          <p>
            We couldn&apos;t locate this collision in your local archive.
            It may have been generated on another device, or your cache was
            cleared.
          </p>
          <Link href="/" className="c-cta c-cta--primary">
            ← Back to LMAO
          </Link>
        </div>
      </div>
    );
  }

  const company = collision.company_name;
  const founded = new Date(collision.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="c-page" style={pageStyle} data-theme={collision.theme}>
      {/* NAV */}
      <header className="c-nav">
        <div className="c-nav-inner">
          <Link href="/" className="c-brand-link">
            <span className="c-brand-mark c-brand-mark--icon">
              <IdeaIcon
                name={company}
                tagline={collision.tagline}
                mechanism={collision.mechanism}
                domain={collision.domain}
                size={20}
              />
            </span>
            <span className="c-brand-name">{company}</span>
          </Link>
          <nav className="c-nav-links">
            <a href="#mechanism">Mechanism</a>
            <a href="#origin">Origin</a>
            <a href="#store">Store</a>
            <Link href="/" className="c-nav-back">← LMAO</Link>
          </nav>
          <div className="c-nav-cart">
            <button className="c-cta c-cta--ghost" aria-label="Cart">
              CART · {cartCount}
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="c-hero">
        <div className="c-hero-inner">
          <div className="c-hero-left">
            <div className="c-eyebrow">
              <span className="c-eyebrow-dot" />
              FIELD COLLISION · {founded.toUpperCase()}
            </div>
            <h1 className="c-hero-title">{company}</h1>
            <p className="c-hero-tagline">{collision.tagline}</p>
            <p className="c-hero-blurb">{collision.mechanism}</p>
            <div className="c-hero-actions">
              <a href="#store" className="c-cta c-cta--primary">
                Shop the field kit
              </a>
              <a href="#mechanism" className="c-cta c-cta--outline">
                Read the mechanism
              </a>
            </div>
            <div className="c-hero-meta">
              <div className="c-meta-block">
                <div className="c-meta-label">Brief</div>
                <div className="c-meta-value">{collision.brief}</div>
              </div>
              <div className="c-meta-block">
                <div className="c-meta-label">Domain</div>
                <div className="c-meta-value">{collision.domain}</div>
              </div>
            </div>
          </div>
          <div className="c-hero-right">
            <div className="c-hero-art">
              {collision.ideaLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={collision.ideaLogo}
                  alt={`${company} mark`}
                  className="c-hero-photo"
                />
              ) : (
                <div className="c-hero-fallback">
                  <IdeaIcon
                    name={company}
                    tagline={collision.tagline}
                    mechanism={collision.mechanism}
                    domain={collision.domain}
                    size={180}
                  />
                </div>
              )}
              <div className="c-hero-badge">
                <DomainIcon domain={collision.domain} size={28} />
                <span>{collision.domain}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MECHANISM */}
      <section className="c-section" id="mechanism">
        <div className="c-section-inner">
          <div className="c-section-head">
            <div className="c-section-num">01 · Mechanism</div>
            <h2 className="c-section-title">How {company} works</h2>
          </div>
          <div className="c-grid-3">
            <div className="c-stat-card">
              <div className="c-stat-label">Active principle</div>
              <div className="c-stat-body">{collision.domain_principle}</div>
            </div>
            <div className="c-stat-card">
              <div className="c-stat-label">Bridging question</div>
              <div className="c-stat-body c-italic">{collision.domain_question}</div>
            </div>
            <div className="c-stat-card c-stat-card--accent">
              <div className="c-stat-label">Result</div>
              <div className="c-stat-body">{collision.mechanism}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ORIGIN */}
      <section className="c-section c-section--alt" id="origin">
        <div className="c-section-inner">
          <div className="c-section-head">
            <div className="c-section-num">02 · Origin</div>
            <h2 className="c-section-title">The collision</h2>
          </div>
          <div className="c-origin">
            <div className="c-origin-side">
              <div className="c-origin-label">Brief</div>
              <div className="c-origin-value">{collision.brief}</div>
            </div>
            <div className="c-origin-mid" aria-hidden="true">
              <div className="c-origin-line" />
              <div className="c-origin-pulse">×</div>
              <div className="c-origin-line" />
            </div>
            <div className="c-origin-side c-origin-side--right">
              <div className="c-origin-label">Domain</div>
              <div className="c-origin-value">{collision.domain}</div>
            </div>
          </div>
          <p className="c-origin-blurb">
            {company} exists at the seam between <em>{collision.brief}</em> and{" "}
            <em>{collision.domain}</em>. We borrowed{" "}
            <strong>{collision.domain_principle.toLowerCase().replace(/\.$/, "")}</strong>{" "}
            and asked: {collision.domain_question}
          </p>
        </div>
      </section>

      {/* STORE */}
      <section className="c-section" id="store">
        <div className="c-section-inner">
          <div className="c-section-head">
            <div className="c-section-num">03 · Store</div>
            <h2 className="c-section-title">Field kit</h2>
            <p className="c-section-blurb">
              Goods printed in small runs the day after each collision. Every
              piece carries the {company} mark and a collision date.
            </p>
          </div>
          {merchLoading && (
            <div className="c-merch-status" aria-live="polite">
              Generating the line — one creative concept + print artwork per
              product. This takes ~30-60 seconds the first time…
            </div>
          )}
          {merchError && (
            <div className="c-merch-status c-merch-status--err">
              Couldn&apos;t generate company-specific merch ({merchError}). Showing
              the generic line for now — refresh to retry.
            </div>
          )}
          <div className="c-products">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                company={company}
                printIcon={getIdeaIconPaths(company, {
                  tagline: collision.tagline,
                  mechanism: collision.mechanism,
                  domain: collision.domain,
                })}
                buyState={buyState[p.id] ?? 'idle'}
                onBuy={() => buyProduct(p.id, p.name, p.price)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="c-footer">
        <div className="c-footer-inner">
          <div className="c-footer-brand">
            <span className="c-brand-mark c-brand-mark--lg c-brand-mark--icon">
              <IdeaIcon
                name={company}
                tagline={collision.tagline}
                mechanism={collision.mechanism}
                domain={collision.domain}
                size={32}
              />
            </span>
            <div>
              <div className="c-footer-name">{company}</div>
              <div className="c-footer-tagline">{collision.tagline}</div>
            </div>
          </div>
          <div className="c-footer-cols">
            <div>
              <div className="c-footer-col-title">Field</div>
              <a href="#mechanism">Mechanism</a>
              <a href="#origin">Origin</a>
              <a href="#store">Store</a>
            </div>
            <div>
              <div className="c-footer-col-title">Company</div>
              <a href="#">Manifesto</a>
              <a href="#">Press kit</a>
              <a href="#">Careers</a>
            </div>
            <div>
              <div className="c-footer-col-title">Network</div>
              <a href="#">Twitter</a>
              <a href="#">GitHub</a>
              <a href="#">Discord</a>
            </div>
          </div>
        </div>
        <div className="c-footer-bottom">
          <span>© {new Date().getFullYear()} {company}</span>
          <span>·</span>
          <span>
            A{" "}
            <Link href="/" className="c-footer-link">
              LMAO
            </Link>{" "}
            collision · {founded}
          </span>
        </div>
      </footer>

      {toast && <div className="c-toast">{toast}</div>}
    </div>
  );
}

function ProductCard({
  product,
  company,
  printIcon,
  buyState,
  onBuy,
}: {
  product: Product;
  company: string;
  printIcon: { paths: React.ReactNode; strokeWidth: number };
  buyState: BuyState;
  onBuy: () => void;
}) {
  const paying = buyState === 'paying';
  const paid = buyState === 'paid';
  const label = paying ? 'Paying…' : paid ? `Bought · buy another` : `Buy · $${product.price}`;
  return (
    <div className="c-product">
      <div className="c-product-art">
        <ProductMockup
          shape={product.shape}
          printIcon={printIcon}
          printUrl={product.printUrl ?? null}
          mockupUrl={product.mockupUrl ?? null}
        />
      </div>
      <div className="c-product-body">
        <div className="c-product-name">
          <span>{product.name}</span>
          <span className="c-product-price">${product.price}</span>
        </div>
        <div className="c-product-blurb">{product.blurb}</div>
        {product.printConcept && (
          <div className="c-product-concept" title={product.printConcept}>
            ↳ {product.printConcept}
          </div>
        )}
        <button
          className="c-product-cta"
          onClick={onBuy}
          disabled={paying}
          aria-busy={paying}
          data-state={buyState}
        >
          {label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <div className="c-product-meta">
          x402 · Base Sepolia · {company.toLowerCase().replace(/\s+/g, "-")}.shop
        </div>
      </div>
    </div>
  );
}

/**
 * Each shape declares its "print area" rectangle (where the company-specific
 * print artwork lands on the product). When `printUrl` is set, we render an
 * SVG <image> in that rect; otherwise we embed the company's themed concept
 * icon (keyword-matched from name/tagline/mechanism) as the print so the
 * mockup looks on-brand even before AI print generation finishes.
 *
 * `clipId` ensures multiple cards' clip-paths don't collide (sticker uses
 * a circular clip, others rectangular).
 */
function ProductMockup({
  shape,
  printIcon,
  printUrl,
  mockupUrl,
}: {
  shape: ProductShape;
  printIcon: { paths: React.ReactNode; strokeWidth: number };
  printUrl: string | null;
  mockupUrl: string | null;
}) {
  // When Printify gave us a real product photo, use it as-is. The image
  // already carries the rendered print artwork on the actual product, so
  // we don't need the SVG outline + overlay at all.
  if (mockupUrl) {
    return (
      <img
        src={mockupUrl}
        alt={`${shape} mockup`}
        className="c-product-mockup-photo"
        loading="lazy"
      />
    );
  }

  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const clipId = `mockup-clip-${shape}-${Math.random().toString(36).slice(2, 8)}`;

  const printArea: Record<ProductShape, { x: number; y: number; w: number; h: number; isCircle?: boolean }> = {
    tee:     { x: 75, y: 92, w: 50, h: 50 },
    hoodie:  { x: 80, y: 112, w: 40, h: 40 },
    mug:     { x: 62, y: 70, w: 66, h: 66 },
    sticker: { x: 50, y: 50, w: 100, h: 100, isCircle: true },
    tote:    { x: 72, y: 100, w: 56, h: 56 },
    poster:  { x: 60, y: 50, w: 80, h: 100 },
  };

  const area = printArea[shape];

  const printOverlay = printUrl ? (
    <>
      <defs>
        {area.isCircle ? (
          <clipPath id={clipId}>
            <circle cx={area.x + area.w / 2} cy={area.y + area.h / 2} r={area.w / 2 - 2} />
          </clipPath>
        ) : (
          <clipPath id={clipId}>
            <rect x={area.x} y={area.y} width={area.w} height={area.h} rx={2} />
          </clipPath>
        )}
      </defs>
      <image
        href={printUrl}
        x={area.x}
        y={area.y}
        width={area.w}
        height={area.h}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
    </>
  ) : (
    /* Embed the themed icon as the print artwork. Scale 48x48 viewBox -> area */
    <g
      transform={`translate(${area.x + area.w / 2 - area.w * 0.35}, ${area.y + area.h / 2 - area.w * 0.35}) scale(${(area.w * 0.7) / 48})`}
      strokeWidth={printIcon.strokeWidth}
    >
      {printIcon.paths}
    </g>
  );

  switch (shape) {
    case "tee":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <path d="M40 60 L60 40 L80 50 Q100 60 120 50 L140 40 L160 60 L150 90 L130 80 L130 170 L70 170 L70 80 L50 90 Z" />
          {printOverlay}
        </svg>
      );
    case "hoodie":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <path d="M40 70 L65 45 L80 55 Q100 95 120 55 L135 45 L160 70 L150 100 L135 90 L135 175 L65 175 L65 90 L50 100 Z" />
          <path d="M80 55 Q100 80 120 55" />
          {printOverlay}
        </svg>
      );
    case "mug":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <rect x="55" y="55" width="80" height="100" rx="8" />
          <path d="M135 80 Q170 80 170 105 Q170 130 135 130" />
          {printOverlay}
        </svg>
      );
    case "sticker":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <circle cx="100" cy="100" r="60" />
          <circle cx="100" cy="100" r="50" strokeDasharray="3 4" />
          {printOverlay}
        </svg>
      );
    case "tote":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <path d="M55 70 L55 175 L145 175 L145 70" />
          <path d="M75 70 Q75 30 100 30 Q125 30 125 70" />
          {printOverlay}
        </svg>
      );
    case "poster":
      return (
        <svg viewBox="0 0 200 200" {...common}>
          <rect x="50" y="30" width="100" height="140" />
          {printOverlay}
        </svg>
      );
  }
}
