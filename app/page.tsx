/**
 * @purpose LMAO landing page. Markets the value prop (humans + agents buying and
 *   building via visa-cli), shows the user's live balance + card + email pulled
 *   from /api/visa/account/status, surfaces a banner of recent collisions from
 *   localStorage, and walks the visitor through install / sign-up / top-up.
 */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoredCollision } from "@/lib/collision-store";

interface AccountStatus {
  enrolled: boolean;
  email: string | null;
  balance: number | null;
  currency: string;
  spending: {
    dailyLimit: number | null;
    dailySpent: number | null;
    dailyRemaining: number | null;
    maxPerTxn: number | null;
  };
  cards: {
    count: number;
    default: { brand: string; last4: string } | null;
  };
  biometric: {
    required: boolean;
    keyRegistered: boolean;
    deviceAvailable: boolean;
  };
  cliVersion: string | null;
  recent: Array<{ ts: string; delta: number; balance: number; reason: string }>;
  error?: string;
  code?: string;
}

const REVIEWS = [
  {
    name: "Jamila Okafor",
    role: "Founder · Atlas Labs",
    body: "We point three coding agents at LMAO every morning. They buy the images, models, and 3D assets they need without me babysitting a corporate card. Spend headroom is the only knob I touch.",
    rating: 5,
    accent: "#FF6A2D",
  },
  {
    name: "Theo Verlaine",
    role: "Indie hacker · Paris",
    body: "I shipped a paid AI app on a Sunday. The collision engine gave me the wedge, the marketplace let me prototype every step on Visa's rails. Took $7.40 to validate.",
    rating: 5,
    accent: "#21B66B",
  },
  {
    name: "Mira Ostrowski",
    role: "Head of Platform · Helix",
    body: "Honestly the cleanest agent-payments primitive I've used. Top-up, daily caps, per-merchant receipts, JSON envelopes — it's an API masquerading as a CLI.",
    rating: 5,
    accent: "#5A8DFF",
  },
  {
    name: "Kenji Halverson",
    role: "Studio lead · Bauhaus.gg",
    body: "My agents now pay for music, voice, and 3D inside the same loop. The marketplace bits feel like the App Store for autonomous work.",
    rating: 5,
    accent: "#C064FF",
  },
];

const FEATURES = [
  {
    title: "Wallet-grade rails",
    desc: "A real Visa-backed prepaid balance with daily caps, per-merchant receipts, and Touch ID guardrails. No keys to leak.",
  },
  {
    title: "Humans + agents in one place",
    desc: "Same checkout, same ledger. Your team can pay; your agents can pay. You watch the spend in one feed.",
  },
  {
    title: "Bisociation marketplace",
    desc: "Smash two distant domains together and we'll spin up the startup, the logo, and a buy-page in seconds — all paid for by the CLI.",
  },
  {
    title: "Auditable by default",
    desc: "Every paid call returns a JSON envelope with amount, merchant, and transaction id. Pipe it to your own DB.",
  },
];

const TOPUP_AMOUNTS = [5, 10, 25, 50];

function formatUsd(
  n: number | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (opts.compact && n >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toFixed(2)}`;
}

type InstallClientKey = "claude-code" | "codex" | "mobile";

interface InstallTarget {
  id: InstallClientKey;
  label: string;
  eyebrow: string;
  command: string;
  manualConfig?: string;
  manualConfigLang?: "json" | "toml";
  notes: string[];
  icon: "terminal" | "mobile";
}

const FULL_SETUP_COMMAND =
  "npm install -g @visa/cli && visa-cli setup && visa-cli install";

const INSTALL_TARGETS: InstallTarget[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    eyebrow: "CLI · Desktop · Web",
    command: `${FULL_SETUP_COMMAND} claude`,
    manualConfig: `{
  "mcpServers": {
    "visa-cli": {
      "command": "visa-cli",
      "args": ["mcp"]
    }
  }
}`,
    manualConfigLang: "json",
    notes: [
      "One install covers all three surfaces — CLI (terminal), desktop app (Mac/Windows), and web (claude.ai/code).",
      "After installing, restart Claude Code or type /mcp inside Claude Code and reconnect visa-cli.",
      "/mcp is a Claude Code command — do not run it in Terminal or PowerShell.",
    ],
    icon: "terminal",
  },
  {
    id: "codex",
    label: "Codex",
    eyebrow: "Terminal · MCP",
    command: `${FULL_SETUP_COMMAND} codex`,
    manualConfig: `[mcp_servers.visa-cli]
command = "visa-cli"
args = ["mcp"]`,
    manualConfigLang: "toml",
    notes: [
      "Restart Codex after installing.",
      "If sandboxing blocks ~/.codex/config.toml, run the command from a normal terminal or with filesystem access.",
      "Codex does not support the Visa HUD yet; use Claude Code for the spend HUD.",
    ],
    icon: "terminal",
  },
  {
    id: "mobile",
    label: "Mobile",
    eyebrow: "Coming soon",
    command: "Mobile MCP support is coming soon. Use a desktop client for now.",
    notes: [
      "Local MCP servers require a desktop or terminal — no agent platform supports mobile MCP today.",
      "Remote MCP will enable mobile use once available. More platforms coming separately.",
    ],
    icon: "mobile",
  },
];

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [collisions, setCollisions] = useState<StoredCollision[]>([]);
  const [installCopied, setInstallCopied] = useState(false);
  const [installCopiedKey, setInstallCopiedKey] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installClient, setInstallClient] = useState<InstallClientKey>(
    "claude-code",
  );
  const installModalRef = useRef<HTMLDivElement>(null);

  const selectedInstall = useMemo(
    () =>
      INSTALL_TARGETS.find((t) => t.id === installClient) ?? INSTALL_TARGETS[0],
    [installClient],
  );

  const copyToClipboard = useCallback(
    async (value: string, key: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setInstallCopiedKey(key);
        setTimeout(() => setInstallCopiedKey(null), 1800);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    const saved =
      (typeof window !== "undefined"
        ? (localStorage.getItem("oc-theme") as "light" | "dark" | null)
        : null) ?? "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("oc-theme", next);
      return next;
    });
  }, []);

  const refreshStatus = useCallback(async (opts?: { force?: boolean }) => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(
        `/api/visa/account/status${opts?.force ? "?refresh=1" : ""}`,
        {
          cache: "no-store",
        },
      );
      const data = (await res.json()) as AccountStatus;
      setStatus(data);
      if (data.error) {
        setStatusError(data.error);
      }
    } catch (err) {
      setStatusError((err as Error).message);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("lmao:collisions:v1");
      if (!raw) {
        setCollisions([]);
        return;
      }
      const map = JSON.parse(raw) as Record<string, StoredCollision>;
      const list = Object.values(map)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 18);
      setCollisions(list);
    } catch {
      setCollisions([]);
    }
  }, []);

  useEffect(() => {
    if (!showInstallModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInstallModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInstallModal]);

  const copyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedInstall.command);
      setInstallCopied(true);
      setTimeout(() => setInstallCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, []);

  const spendingPct = useMemo(() => {
    const limit = status?.spending.dailyLimit;
    const spent = status?.spending.dailySpent;
    if (!limit || spent == null) return 0;
    return Math.min(100, Math.round((spent / limit) * 100));
  }, [status]);

  const userLabel = useMemo(() => {
    if (status?.email) return status.email;
    if (status?.cards.default) {
      const { brand, last4 } = status.cards.default;
      return `${brand.toUpperCase()} •••• ${last4}`;
    }
    return null;
  }, [status]);

  const enrolled = Boolean(status?.enrolled);

  return (
    <div className="lmao-page">
      {/* ───── TOP NAV ───── */}
      <header className="lmao-nav">
        <div className="lmao-nav-inner">
          <Link href="/" className="lmao-brand" prefetch={false}>
            <span className="lmao-brand-mark">LMAO</span>
            <span className="lmao-brand-decoder">
              <span>Liquid</span>
              <span aria-hidden="true">·</span>
              <span>Money</span>
              <span aria-hidden="true">·</span>
              <span>Angel</span>
              <span aria-hidden="true">·</span>
              <span>Org</span>
            </span>
          </Link>

          <nav className="lmao-nav-links" aria-label="Primary">
            <a href="#how" className="lmao-nav-link">
              How it works
            </a>
            <a href="#reviews" className="lmao-nav-link">
              Reviews
            </a>
            <a href="#install" className="lmao-nav-link">
              Install
            </a>
            <Link
              href="/marketplace"
              className="lmao-nav-link"
              prefetch={false}
            >
              Marketplace
            </Link>
          </nav>

          <div className="lmao-nav-right">
            <button
              className="lmao-balance-pill"
              onClick={() => refreshStatus({ force: true })}
              title={
                statusError
                  ? `visa-cli unavailable: ${statusError}`
                  : "Click to refresh balance"
              }
            >
              <span
                className={`lmao-balance-dot${
                  statusLoading
                    ? " is-loading"
                    : enrolled
                      ? " is-ok"
                      : " is-off"
                }`}
                aria-hidden="true"
              />
              <span className="lmao-balance-amount">
                {statusLoading
                  ? "…"
                  : formatUsd(status?.balance ?? null, { compact: true })}
              </span>
              {userLabel && (
                <span className="lmao-balance-user" title={userLabel}>
                  {userLabel}
                </span>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>

            <button
              className="lmao-icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button
              className="lmao-nav-cta"
              onClick={() => setShowInstallModal(true)}
            >
              {enrolled ? "Top up" : "Get visa-cli"}
            </button>
          </div>
        </div>
      </header>

      <main className="lmao-main">
        {/* ───── HERO ───── */}
        <section className="lmao-hero">
          <div className="lmao-hero-text">
            <div className="lmao-pill">
              <span className="lmao-pill-dot" aria-hidden="true" />
              <span>powered by visa-cli · v{status?.cliVersion ?? "2.2"}</span>
            </div>
            <h1 className="lmao-h1">
              The marketplace where <em>agents and humans</em> buy and build
              things.
            </h1>
            <p className="lmao-sub">
              LMAO — Liquid Money for the Angel Organization — is a credit rail,
              a model catalog, and a bisociation engine. Top up once. Spend on
              images, code, music, 3D, LLMs, and entire startup experiments.
              Your wallet keeps the receipts.
            </p>
            <div className="lmao-hero-ctas">
              <Link
                href="/marketplace"
                className="lmao-cta lmao-cta-primary"
                prefetch={false}
              >
                Enter the marketplace
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                className="lmao-cta lmao-cta-ghost"
                onClick={() => setShowInstallModal(true)}
              >
                Install visa-cli
              </button>
            </div>
            <div className="lmao-hero-stats">
              <div className="lmao-stat">
                <div className="lmao-stat-num">
                  {statusLoading ? "…" : formatUsd(status?.balance ?? null)}
                </div>
                <div className="lmao-stat-label">your balance</div>
              </div>
              <div className="lmao-stat">
                <div className="lmao-stat-num">
                  {statusLoading
                    ? "…"
                    : formatUsd(status?.spending.dailyRemaining ?? null)}
                </div>
                <div className="lmao-stat-label">today&apos;s headroom</div>
              </div>
              <div className="lmao-stat">
                <div className="lmao-stat-num">
                  {statusLoading ? "…" : (status?.cards.count ?? 0)}
                </div>
                <div className="lmao-stat-label">cards on file</div>
              </div>
            </div>
          </div>
          <div className="lmao-hero-art">
            <div className="lmao-hero-frame lmao-hero-frame-main">
              <Image
                src="/landing/hero-network.jpg"
                alt="Two founders laughing in a sunset-lit co-working loft"
                width={1024}
                height={1024}
                priority
              />
              <div className="lmao-hero-badge">
                <span className="lmao-hero-badge-dot" />
                live on visa-cli
              </div>
            </div>
            <div className="lmao-hero-frame lmao-hero-frame-stack">
              <Image
                src="/landing/agent-marketplace.jpg"
                alt="Desk overhead with payment card and laptop"
                width={1024}
                height={1024}
              />
            </div>
            <div className="lmao-hero-frame lmao-hero-frame-stack-2">
              <Image
                src="/landing/collisions.jpg"
                alt="Two glowing spheres colliding in mid-air"
                width={1024}
                height={1024}
              />
            </div>
          </div>
        </section>

        {/* ───── COLLISIONS BANNER ───── */}
        <section className="lmao-collisions" aria-labelledby="collisions-title">
          <div className="lmao-section-head">
            <div>
              <div className="lmao-section-eyebrow">currently available</div>
              <h2 id="collisions-title" className="lmao-section-title">
                Live collisions on the floor
              </h2>
            </div>
            <Link
              href="/marketplace"
              className="lmao-section-link"
              prefetch={false}
            >
              Run your own →
            </Link>
          </div>

          {collisions.length === 0 ? (
            <div className="lmao-collisions-empty">
              <div className="lmao-collisions-empty-art" aria-hidden="true">
                <div className="orbit" />
                <div className="orbit" />
                <div className="orbit" />
              </div>
              <div>
                <div className="lmao-collisions-empty-title">
                  No collisions in this browser yet.
                </div>
                <div className="lmao-collisions-empty-sub">
                  Pop into the marketplace and smash two distant domains
                  together — they&apos;ll show up here for everyone with the
                  same session.
                </div>
              </div>
              <Link
                href="/marketplace"
                className="lmao-cta lmao-cta-primary"
                prefetch={false}
              >
                Start a collision
              </Link>
            </div>
          ) : (
            <div className="lmao-collisions-rail">
              {collisions.map((c) => {
                const initials = c.company_name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <Link
                    key={c.slug}
                    href={`/c/${c.slug}`}
                    className="lmao-collision-card"
                    style={
                      {
                        ["--card-accent" as string]: c.domainColor,
                      } as React.CSSProperties
                    }
                    prefetch={false}
                  >
                    <div className="lmao-collision-art">
                      {c.ideaLogo ? (
                        <Image
                          src={c.ideaLogo}
                          alt={c.company_name}
                          width={160}
                          height={160}
                        />
                      ) : c.domainLogo ? (
                        <Image
                          src={c.domainLogo}
                          alt={c.domain}
                          width={160}
                          height={160}
                        />
                      ) : (
                        <div className="lmao-collision-initials">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="lmao-collision-body">
                      <div className="lmao-collision-name">
                        {c.company_name}
                      </div>
                      <div className="lmao-collision-tag">
                        {c.tagline || c.domain}
                      </div>
                      <div className="lmao-collision-meta">
                        <span>{c.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {relativeTime(new Date(c.createdAt).toISOString())}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ───── HOW IT WORKS ───── */}
        <section id="how" className="lmao-how">
          <div className="lmao-section-head">
            <div>
              <div className="lmao-section-eyebrow">how it works</div>
              <h2 className="lmao-section-title">
                Four primitives. One credit rail.
              </h2>
            </div>
          </div>
          <div className="lmao-features-grid">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="lmao-feature">
                <div className="lmao-feature-num">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="lmao-feature-title">{f.title}</div>
                <div className="lmao-feature-desc">{f.desc}</div>
              </article>
            ))}
          </div>
        </section>

        {/* ───── BALANCE + TOP UP ───── */}
        <section id="balance" className="lmao-wallet">
          <div className="lmao-wallet-card">
            <div className="lmao-wallet-head">
              <div>
                <div className="lmao-section-eyebrow">your wallet</div>
                <h2 className="lmao-section-title">
                  {enrolled ? "You're on the rails." : "One terminal away."}
                </h2>
              </div>
              <button
                className="lmao-link-btn"
                onClick={() => refreshStatus({ force: true })}
                disabled={statusLoading}
              >
                {statusLoading ? "refreshing…" : "refresh"}
              </button>
            </div>

            {statusError && !enrolled && (
              <div className="lmao-wallet-warning">
                visa-cli isn&apos;t reachable from the server — install it first
                to see live balance.
              </div>
            )}

            <div className="lmao-wallet-grid">
              <div className="lmao-wallet-figure">
                <div className="lmao-wallet-amount">
                  {statusLoading ? "…" : formatUsd(status?.balance ?? null)}
                </div>
                <div className="lmao-wallet-label">prepaid balance</div>
                {userLabel && (
                  <div className="lmao-wallet-user">
                    <span className="lmao-wallet-user-dot" />
                    {userLabel}
                  </div>
                )}
              </div>

              <div className="lmao-wallet-meter">
                <div className="lmao-meter-row">
                  <span>today&apos;s spend</span>
                  <span>
                    {formatUsd(status?.spending.dailySpent ?? null)} /{" "}
                    {formatUsd(status?.spending.dailyLimit ?? null)}
                  </span>
                </div>
                <div className="lmao-meter-bar">
                  <div
                    className="lmao-meter-fill"
                    style={{ width: `${spendingPct}%` }}
                  />
                </div>
                <div className="lmao-meter-row lmao-meter-row-foot">
                  <span>headroom</span>
                  <span>
                    {formatUsd(status?.spending.dailyRemaining ?? null)}
                  </span>
                </div>

                {status?.recent && status.recent.length > 0 && (
                  <ul className="lmao-recent">
                    {status.recent.slice(0, 4).map((r, i) => (
                      <li key={`${r.ts}-${i}`}>
                        <span className="lmao-recent-when">
                          {relativeTime(r.ts)}
                        </span>
                        <span className="lmao-recent-reason">{r.reason}</span>
                        <span
                          className={`lmao-recent-delta${r.delta < 0 ? " neg" : " pos"}`}
                        >
                          {r.delta < 0 ? "-" : "+"}$
                          {Math.abs(r.delta).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="lmao-topup">
                <div className="lmao-topup-title">Top up balance</div>
                <div className="lmao-topup-grid">
                  {TOPUP_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      className="lmao-topup-btn"
                      onClick={() => setShowInstallModal(true)}
                      title={`Top up $${amt} via visa-cli`}
                    >
                      <span className="lmao-topup-amt">${amt}</span>
                      <span className="lmao-topup-cmd">
                        visa-cli balance topup -a {amt}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="lmao-topup-foot">
                  Top-ups require Touch ID — they run locally through your
                  visa-cli.
                  <button
                    className="lmao-link-inline"
                    onClick={() => setShowInstallModal(true)}
                  >
                    show me how
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── REVIEWS ───── */}
        <section id="reviews" className="lmao-reviews">
          <div className="lmao-section-head">
            <div>
              <div className="lmao-section-eyebrow">why people use it</div>
              <h2 className="lmao-section-title">
                Operators, agents, and one cat say nice things.
              </h2>
            </div>
          </div>
          <div className="lmao-reviews-grid">
            {REVIEWS.map((r) => {
              const initials = r.name
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join("");
              return (
                <article
                  key={r.name}
                  className="lmao-review"
                  style={
                    {
                      ["--card-accent" as string]: r.accent,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="lmao-review-stars"
                    aria-label={`${r.rating} out of 5`}
                  >
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <svg
                        key={i}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="lmao-review-body">
                    &ldquo;{r.body}&rdquo;
                  </blockquote>
                  <div className="lmao-review-foot">
                    <div className="lmao-review-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div>
                      <div className="lmao-review-name">{r.name}</div>
                      <div className="lmao-review-role">{r.role}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ───── INSTALL / SIGN UP ───── */}
        <section id="install" className="lmao-install">
          <div className="lmao-install-art">
            <Image
              src="/landing/builders.jpg"
              alt="Engineer wearing headphones in golden hour light"
              width={1024}
              height={1024}
              className="lmao-install-image"
            />
          </div>
          <div className="lmao-install-content">
            <div className="lmao-section-eyebrow">install · sign up</div>
            <h2 className="lmao-install-title">
              Three lines, then you&apos;re shipping.
            </h2>
            <p className="lmao-install-sub">
              Visa-cli runs locally, holds your keys, and handles biometric
              auth. No SaaS in the middle. We just give it a beautiful
              marketplace to live in.
            </p>

            <ol className="lmao-install-steps">
              <li>
                <span className="lmao-step-num">1</span>
                <div>
                  <div className="lmao-step-title">Install the CLI</div>
                  <pre className="lmao-code">
                    <code>npm install -g visa-cli</code>
                  </pre>
                </div>
              </li>
              <li>
                <span className="lmao-step-num">2</span>
                <div>
                  <div className="lmao-step-title">Enroll in 30 seconds</div>
                  <pre className="lmao-code">
                    <code>visa-cli setup</code>
                  </pre>
                  <div className="lmao-step-note">
                    Opens a browser, attaches a Visa card, registers an
                    attestation key.
                  </div>
                </div>
              </li>
              <li>
                <span className="lmao-step-num">3</span>
                <div>
                  <div className="lmao-step-title">Top up + start spending</div>
                  <pre className="lmao-code">
                    <code>visa-cli balance topup -a 25</code>
                  </pre>
                  <div className="lmao-step-note">
                    Or skip top-up entirely — daily-cap charges hit your card
                    directly.
                  </div>
                </div>
              </li>
            </ol>

            <div className="lmao-install-ctas">
              <button
                className="lmao-cta lmao-cta-primary"
                onClick={copyInstall}
              >
                {installCopied ? "Copied ✓" : "Copy one-liner"}
              </button>
              <a
                href="https://visacli.sh"
                target="_blank"
                rel="noreferrer"
                className="lmao-cta lmao-cta-ghost"
              >
                Read the docs
              </a>
            </div>
          </div>
        </section>

        {/* ───── FOOTER ───── */}
        <footer className="lmao-footer">
          <div className="lmao-footer-inner">
            <div className="lmao-footer-brand">
              <span className="lmao-brand-mark">LMAO</span>
              <span className="lmao-footer-tagline">
                liquid money for the angel organization
              </span>
            </div>
            <div className="lmao-footer-links">
              <Link href="/marketplace" prefetch={false}>
                Marketplace
              </Link>
              <a href="#install">Install</a>
              <a href="#reviews">Reviews</a>
              <a href="https://visacli.sh" target="_blank" rel="noreferrer">
                visa-cli
              </a>
            </div>
            <div className="lmao-footer-note">
              Built on visa-cli {status?.cliVersion ?? "2.2.0"} ·
              {enrolled ? " enrolled" : " not enrolled"} · headroom{" "}
              {formatUsd(status?.spending.dailyRemaining ?? null)}
            </div>
          </div>
        </footer>
      </main>

      {/* ───── INSTALL / TOP-UP MODAL ───── */}
      {showInstallModal && (
        <div
          className="lmao-modal-overlay"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="lmao-modal"
            onClick={(e) => e.stopPropagation()}
            ref={installModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lmao-modal-title"
          >
            <button
              className="lmao-modal-close"
              onClick={() => setShowInstallModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="lmao-modal-eyebrow">
              {enrolled
                ? "top up your visa-cli wallet"
                : "install visa-cli · MCP"}
            </div>
            <h3 id="lmao-modal-title" className="lmao-modal-title">
              {enrolled
                ? "Top up runs locally — Touch ID, no detour."
                : "Copy the exact install command for your agent."}
            </h3>

            {enrolled ? (
              <>
                <ol className="lmao-modal-steps">
                  <li>
                    <span className="lmao-step-num">1</span>
                    <div>
                      <pre className="lmao-code lmao-code-block">
                        <code>visa-cli balance topup -a 25</code>
                      </pre>
                      <div className="lmao-step-note">
                        Touch ID protects every charge over $5.
                      </div>
                    </div>
                  </li>
                </ol>
                <div className="lmao-modal-ctas">
                  <button
                    className="lmao-cta lmao-cta-primary"
                    onClick={() =>
                      copyToClipboard(
                        "visa-cli balance topup -a 25",
                        "topup",
                      )
                    }
                  >
                    {installCopiedKey === "topup"
                      ? "Copied ✓"
                      : "Copy top-up command"}
                  </button>
                  <a
                    href="https://visacli.sh/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="lmao-cta lmao-cta-ghost"
                  >
                    Open docs ↗
                  </a>
                </div>
              </>
            ) : (
              <div className="lmao-install-picker">
                <p className="lmao-install-picker-sub">
                  Pick your agent. One command installs the CLI, runs setup,
                  and writes the MCP config.
                </p>
                <div className="lmao-install-tabs" role="tablist">
                  {INSTALL_TARGETS.map((t) => {
                    const active = t.id === installClient;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        className={`lmao-install-tab${active ? " lmao-install-tab--active" : ""}`}
                        onClick={() => setInstallClient(t.id)}
                      >
                        <span className="lmao-install-tab-icon" aria-hidden="true">
                          {t.icon === "mobile" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="6" y="2" width="12" height="20" rx="2.5" />
                              <line x1="12" y1="18" x2="12" y2="18.01" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="4 17 10 11 4 5" />
                              <line x1="12" y1="19" x2="20" y2="19" />
                            </svg>
                          )}
                        </span>
                        <span className="lmao-install-tab-text">
                          <span className="lmao-install-tab-label">
                            {t.label}
                          </span>
                          <span className="lmao-install-tab-eyebrow">
                            {t.eyebrow}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="lmao-install-block">
                  <div className="lmao-install-block-head">
                    Install command
                  </div>
                  <div className="lmao-install-code">
                    <pre>
                      <code>{selectedInstall.command}</code>
                    </pre>
                    <button
                      className="lmao-install-copy"
                      onClick={() =>
                        copyToClipboard(selectedInstall.command, "cmd")
                      }
                    >
                      {installCopiedKey === "cmd" ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>

                {selectedInstall.manualConfig && (
                  <div className="lmao-install-block">
                    <div className="lmao-install-block-head">
                      Manual MCP config ({selectedInstall.manualConfigLang})
                    </div>
                    <div className="lmao-install-code">
                      <pre>
                        <code>{selectedInstall.manualConfig}</code>
                      </pre>
                      <button
                        className="lmao-install-copy"
                        onClick={() =>
                          copyToClipboard(
                            selectedInstall.manualConfig!,
                            "manual",
                          )
                        }
                      >
                        {installCopiedKey === "manual" ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                <ul className="lmao-install-notes">
                  {selectedInstall.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>

                <div className="lmao-modal-ctas">
                  <button
                    className="lmao-cta lmao-cta-primary"
                    onClick={copyInstall}
                  >
                    {installCopied ? "Copied ✓" : "Copy one-liner"}
                  </button>
                  <a
                    href="https://visacli.sh/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="lmao-cta lmao-cta-ghost"
                  >
                    Open docs ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
