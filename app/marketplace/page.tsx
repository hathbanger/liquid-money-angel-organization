"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import {
  paletteForBrief,
  DEFAULT_LIGHT_DOMAINS,
  DEFAULT_DARK_DOMAINS,
  type Palette,
} from "@/lib/palettes";
import { DomainIcon, collisionSlug } from "@/lib/domain-icons";
import { IdeaIcon } from "@/lib/idea-icons";
import {
  saveCollision,
  patchCollision,
  listCollisions,
  type StoredCollision,
} from "@/lib/collision-store";

const TITLE_ADJECTIVES = [
  "distant",
  "forgotten",
  "weird",
  "ancient",
  "rival",
  "brilliant",
  "defiant",
  "electric",
];

const DEFAULT_BRIEFS = [
  "crypto wallet onboarding",
  "soul-crushing code review",
  "job interviews that predict nothing",
  "viral CLI tools",
  "Spotify taste bubbles",
  "medical no-shows",
  "first-PR contributor churn",
  "loyalty programs feel like scams",
  "teenagers ignoring finance",
  "conference talks AI era",
  "agent payments trust gap",
  "marketplace cold-start",
  "parks against loneliness",
  "long-form reading addiction",
  "dev communities dying post-launch",
  "stealth math education",
  "anti-polarization voting",
  "enterprise UX that doesn't suck",
  "menus for dietary chaos",
  "unused gym memberships",
];

const SHOWCASE_PAIRS: Array<[string, string]> = [
  ["jazz improvisation", "blockchain consensus"],
  ["honeybee swarms", "code review"],
  ["renaissance ateliers", "team velocity"],
  ["termite mounds", "cold-start markets"],
  ["queueing theory", "dating apps"],
  ["kabbalah", "API design"],
  ["competitive freediving", "incident response"],
  ["coral reef succession", "developer onboarding"],
  ["monastic rules", "remote teams"],
  ["brutalist architecture", "B2B SaaS pricing"],
];

interface Domain {
  domain: string;
  name?: string;
  active_principle: string;
  bridging_question: string;
}

interface Idea {
  company_name?: string;
  name?: string;
  tagline: string;
  mechanism: string;
  attribution: string;
}

interface DomainResult {
  domain: Domain;
  color: string;
  ideas: Idea[];
  domainLogo: string | null;
  ideaLogos: (string | null)[];
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [briefs, setBriefs] = useState<string[]>(DEFAULT_BRIEFS);
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [motifModalOpen, setMotifModalOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [briefsFading, setBriefsFading] = useState(false);
  const [briefsInitialLoading, setBriefsInitialLoading] = useState(false);

  // Main panel state
  const [adjIdx, setAdjIdx] = useState(0);
  const [recentCollisions, setRecentCollisions] = useState<StoredCollision[]>([]);

  const [activeBrief, setActiveBrief] = useState("");
  const [statusText, setStatusText] = useState("");
  const [view, setView] = useState<"empty" | "loading" | "results">("empty");
  const [loadingText, setLoadingText] = useState("colliding domains");
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [mobileResults, setMobileResults] = useState(false);
  const [palette, setPalette] = useState<Palette | null>(null);

  const [showcaseIdx, setShowcaseIdx] = useState(0);
  const [briefPreview, setBriefPreview] = useState<string | null>(null);

  const domainsRef = useRef<Domain[]>([]);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const motifInputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<Palette | null>(null);
  const themeRef = useRef<"light" | "dark">("light");
  const briefRef = useRef<string>("");

  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    briefRef.current = activeBrief;
  }, [activeBrief]);

  // Theme init from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("oc-theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  // Hydrate recent collisions for hero gallery
  useEffect(() => {
    setRecentCollisions(listCollisions(6));
  }, [view]);

  // Cycle the hero title adjective
  useEffect(() => {
    if (view !== "empty") return;
    const id = window.setInterval(() => {
      setAdjIdx((i) => (i + 1) % TITLE_ADJECTIVES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [view]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("oc-theme", next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!motifModalOpen) return;
    motifInputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMotifModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [motifModalOpen]);

  // Cycle showcase domain pairs while user is on the empty state
  useEffect(() => {
    if (view !== "empty") return;
    const id = setInterval(() => {
      setShowcaseIdx((i) => (i + 1) % SHOWCASE_PAIRS.length);
    }, 2600);
    return () => clearInterval(id);
  }, [view]);

  // Cycle a live brief preview for the CTA
  useEffect(() => {
    if (view !== "empty" || briefs.length === 0) {
      setBriefPreview(null);
      return;
    }
    const pick = () => briefs[Math.floor(Math.random() * briefs.length)];
    setBriefPreview(pick());
    const id = setInterval(() => setBriefPreview(pick()), 3400);
    return () => clearInterval(id);
  }, [view, briefs]);

  const getDomainColors = useCallback(() => {
    if (palette) {
      return theme === "dark" ? palette.dark.domains : palette.light.domains;
    }
    return theme === "dark" ? DEFAULT_DARK_DOMAINS : DEFAULT_LIGHT_DOMAINS;
  }, [palette, theme]);

  const tryRandom = useCallback(() => {
    if (briefs.length === 0) return;
    const pick = briefs[Math.floor(Math.random() * briefs.length)];
    setSelectedBrief(pick);
    collide(pick);
  }, [briefs]);

  const useBrief = useCallback((brief: string) => {
    setSelectedBrief(brief);
    collide(brief);
  }, []);

  async function regenExamples() {
    setRegenLoading(true);
    setBriefsFading(true);
    await new Promise((r) => setTimeout(r, 200));
    setBriefsFading(false);
    setBriefsInitialLoading(true);
    setBriefs([]);

    try {
      const res = await fetch("/api/regen-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif: motif.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBriefs(data.briefs);
    } catch (err) {
      console.error("Regen error:", err);
      setBriefs([]);
    } finally {
      setRegenLoading(false);
      setBriefsInitialLoading(false);
    }
  }

  async function submitMotif() {
    setMotifModalOpen(false);
    await regenExamples();
  }

  function goBack() {
    setMobileResults(false);
    window.scrollTo(0, 0);
  }

  async function collide(brief: string) {
    if (!brief || !brief.trim()) return;
    brief = brief.trim();
    setMobileResults(true);
    window.scrollTo(0, 0);

    setActiveBrief(brief);
    briefRef.current = brief;
    const p = paletteForBrief(brief);
    setPalette(p);
    paletteRef.current = p;
    setView("loading");
    setLoadingText("generating distant domains");
    setDomainResults([]);
    setStatusText("");
    domainsRef.current = [];

    try {
      const res = await fetch("/api/collide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            handleEvent(JSON.parse(raw));
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (err: unknown) {
      setStatusText(`Error: ${(err as Error).message}`);
    }
  }

  function handleEvent(msg: Record<string, unknown>) {
    if (msg.type === "status") {
      setLoadingText((msg.message as string).toLowerCase().replace(/\.+$/, ""));
    }

    if (msg.type === "domains") {
      const domains = msg.domains as Domain[];
      domainsRef.current = domains;
      const colors = getDomainColors();
      setView("results");
      setDomainResults(
        domains.map((d, i) => ({
          domain: d,
          color: colors[i % colors.length],
          ideas: [],
          domainLogo: null,
          ideaLogos: [],
        })),
      );
      setStatusText(`${domains.length} domains found — colliding...`);
    }

    if (msg.type === "domain-logos") {
      const logos = msg.logos as (string | null)[];
      setDomainResults((prev) =>
        prev.map((dr, i) => ({
          ...dr,
          domainLogo: logos[i] || dr.domainLogo,
        })),
      );
    }

    if (msg.type === "collision") {
      const idx = msg.domainIndex as number;
      const ideas = msg.ideas as Idea[];
      setDomainResults((prev) => {
        const next = prev.map((dr, i) =>
          i === idx ? { ...dr, ideas, ideaLogos: ideas.map(() => null) } : dr,
        );
        const target = next[idx];
        if (target) {
          const currentPalette = paletteRef.current;
          const currentTheme = themeRef.current;
          const currentBrief = briefRef.current;
          ideas.forEach((idea) => {
            const name = idea.company_name || idea.name || "Untitled";
            saveCollision({
              slug: collisionSlug(currentBrief, name),
              brief: currentBrief,
              company_name: name,
              tagline: idea.tagline || "",
              mechanism: idea.mechanism || "",
              attribution: idea.attribution || "",
              domain: target.domain.domain || target.domain.name || "",
              domain_principle: target.domain.active_principle || "",
              domain_question: target.domain.bridging_question || "",
              domainColor: target.color,
              domainLogo: target.domainLogo,
              ideaLogo: null,
              palette: currentPalette,
              theme: currentTheme,
              createdAt: Date.now(),
            });
          });
        }
        return next;
      });
      setDomainResults((prev) => {
        const filledCount = prev.reduce((acc, dr) => acc + dr.ideas.length, 0);
        const remaining = prev.filter((dr) => dr.ideas.length === 0).length;
        if (remaining > 0) {
          setStatusText(
            `${filledCount} ideas — ${remaining} domain${remaining > 1 ? "s" : ""} remaining...`,
          );
        }
        return prev;
      });
    }

    if (msg.type === "idea-logos") {
      const idx = msg.domainIndex as number;
      const logos = msg.logos as (string | null)[];
      setDomainResults((prev) => {
        const next = prev.map((dr, i) => (i === idx ? { ...dr, ideaLogos: logos } : dr));
        const target = next[idx];
        const currentBrief = briefRef.current;
        if (target) {
          target.ideas.forEach((idea, j) => {
            const name = idea.company_name || idea.name || "Untitled";
            patchCollision(collisionSlug(currentBrief, name), {
              ideaLogo: logos[j] ?? null,
            });
          });
        }
        return next;
      });
    }

    if (msg.type === "done") {
      setDomainResults((prev) => {
        const ideaCount = prev.reduce((acc, dr) => acc + dr.ideas.length, 0);
        setStatusText(`${ideaCount} ideas from ${prev.length} domains`);
        return prev;
      });
    }

    if (msg.type === "error") {
      setView("results");
      setStatusText(`error: ${msg.message}`);
    }
  }

  const variant = palette ? (theme === "dark" ? palette.dark : palette.light) : null;
  const mainPanelStyle: CSSProperties | undefined = variant
    ? ({
        "--accent": variant.main,
        "--accent-hover": variant.hover,
        "--accent-soft": variant.soft,
      } as CSSProperties)
    : undefined;

  return (
    <div className={`layout${mobileResults ? " mobile-results" : ""}`}>
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <Link href="/" className="title-acronym-link" prefetch={false}>
              <h1 className="title-acronym">
                <span className="title-acro">LMAO</span>
                <span className="title-decoder">
                  <span>Liquid</span>
                  <span aria-hidden="true">·</span>
                  <span>Money</span>
                  <span aria-hidden="true">·</span>
                  <span>Angel</span>
                  <span aria-hidden="true">·</span>
                  <span>Org</span>
                </span>
              </h1>
            </Link>
            <div className="tagline">bisociation engine — marketplace</div>
          </div>
        </div>
        <div className="regen-row">
          <button
            className="submit-idea-btn submit-idea-btn--outlined"
            onClick={() => setMotifModalOpen(true)}
            title="Submit an idea for LMAO"
          >
            <span className="submit-idea-label">SUBMIT AN IDEA</span>
            {motif && <span className="submit-idea-preview">{motif}</span>}
          </button>
        </div>
        <div className="briefs-scroll">
          <div className={`examples-grid${briefsFading ? " fading" : ""}`}>
            {briefsInitialLoading ? (
              <div className="briefs-loader">
                <div className="briefs-loader-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="briefs-loader-text">generating briefs</div>
              </div>
            ) : briefs.length === 0 && !briefsInitialLoading ? (
              <div className="briefs-loader">
                <div className="briefs-loader-text">
                  failed to load — try again
                </div>
              </div>
            ) : (
              briefs.map((brief, i) => (
                <button
                  key={`${brief}-${i}`}
                  className={`example-btn fade-in${selectedBrief === brief ? " selected" : ""}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  onClick={() => useBrief(brief)}
                >
                  {brief}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="main-panel" style={mainPanelStyle}>
        <div className="main-header">
          <button className="back-btn" onClick={goBack}>
            ← BRIEFS
          </button>
          {activeBrief && (
            <>
              <span className="active-brief-label">COLLIDING:</span>
              <span className="active-brief-text">{activeBrief}</span>
            </>
          )}
          {statusText && <span className="status">{statusText}</span>}
          <div className="main-header-actions">
            <button
              className={`icon-btn${regenLoading ? " spinning" : ""}`}
              onClick={regenExamples}
              disabled={regenLoading}
              title="Generate new briefs"
              aria-label="Generate new briefs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title="Toggle light/dark mode"
              aria-label="Toggle light/dark mode"
            >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {view === "empty" && (
          <div className="empty-state">
            <div className="hero-glow" aria-hidden="true" />

            <div className="hero-collider" aria-hidden="true">
              <div className="hero-rings">
                <span className="hero-ring" />
                <span className="hero-ring" />
                <span className="hero-ring" />
              </div>
              <span className="hero-particle hero-particle-a" />
              <span className="hero-particle hero-particle-b" />
              <span className="hero-core" />
              <span className="hero-spark" />
              <span className="hero-spark" />
              <span className="hero-spark" />
              <span className="hero-spark" />
              <span className="hero-spark" />
              <span className="hero-spark" />
            </div>

            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true" />
              BISOCIATION ENGINE · v1
            </div>

            <h2 className="hero-title">
              Collide{" "}
              <span className="hero-title-accent-wrap" aria-live="polite">
                <span
                  key={TITLE_ADJECTIVES[adjIdx]}
                  className="hero-title-accent"
                >
                  {TITLE_ADJECTIVES[adjIdx]}
                </span>
              </span>{" "}
              ideas
            </h2>

            <p className="hero-subtitle">
              Pick a brief. We smash it against four unrelated knowledge
              domains and surface startup concepts that could only exist at
              the intersection.
            </p>

            <div
              className="hero-equation"
              aria-live="polite"
              aria-label="Example domain collision"
            >
              <span
                key={`a-${showcaseIdx}`}
                className="hero-eq-chip hero-eq-chip--a"
              >
                {SHOWCASE_PAIRS[showcaseIdx][0]}
              </span>
              <span className="hero-eq-x" aria-hidden="true">×</span>
              <span
                key={`b-${showcaseIdx}`}
                className="hero-eq-chip hero-eq-chip--b"
              >
                {SHOWCASE_PAIRS[showcaseIdx][1]}
              </span>
            </div>

            <ol className="hero-steps">
              <li className="hero-step">
                <span className="hero-step-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h12" />
                    <path d="M4 12h8" />
                    <path d="M4 18h14" />
                    <circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="hero-step-label">Pick a brief</span>
              </li>
              <span className="hero-step-sep" aria-hidden="true" />
              <li className="hero-step">
                <span className="hero-step-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="hero-step-label">4 distant domains</span>
              </li>
              <span className="hero-step-sep" aria-hidden="true" />
              <li className="hero-step">
                <span className="hero-step-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                  </svg>
                </span>
                <span className="hero-step-label">Startups emerge</span>
              </li>
            </ol>

            <button className="hero-cta" onClick={tryRandom}>
              <span className="hero-cta-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                </svg>
              </span>
              <span className="hero-cta-stack">
                <span className="hero-cta-label">Try a random brief</span>
                {briefPreview && (
                  <span key={briefPreview} className="hero-cta-preview">
                    &ldquo;{briefPreview}&rdquo;
                  </span>
                )}
              </span>
              <span className="hero-cta-arrow" aria-hidden="true">→</span>
            </button>

            {recentCollisions.length > 0 && (
              <div className="hero-recent">
                <div className="hero-recent-head">
                  <span className="hero-recent-eyebrow">
                    Live archive · last {recentCollisions.length}
                  </span>
                  <span className="hero-recent-pulse" aria-hidden="true" />
                </div>
                <div className="hero-recent-grid">
                  {recentCollisions.map((c) => {
                    const init = (c.company_name || "??")
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
                        className="hero-recent-card"
                        style={
                          { "--domain-color": c.domainColor } as CSSProperties
                        }
                      >
                        <span className="hero-recent-mark" aria-hidden="true">
                          {init}
                        </span>
                        <span className="hero-recent-body">
                          <span className="hero-recent-name">
                            {c.company_name}
                          </span>
                          <span className="hero-recent-tag">
                            {c.tagline || c.domain}
                          </span>
                        </span>
                        <span className="hero-recent-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="hero-marquee" aria-hidden="true">
              <div className="hero-marquee-track">
                {[...DEFAULT_BRIEFS, ...DEFAULT_BRIEFS].map((b, i) => (
                  <span key={`${b}-${i}`} className="hero-marquee-item">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <div className="hero-footnote">
              Bisociation — <em>Arthur Koestler</em>&apos;s theory of creative
              leaps
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {view === "loading" && (
          <div className="collider-loading">
            <div className="collider-anim">
              <div className="orbit"></div>
              <div className="orbit"></div>
              <div className="orbit"></div>
              <div className="particle particle-a"></div>
              <div className="particle particle-b"></div>
              <div className="core-glow"></div>
              <div className="spark"></div>
              <div className="spark"></div>
              <div className="spark"></div>
              <div className="spark"></div>
              <div className="spark"></div>
              <div className="spark"></div>
            </div>
            <div className="collider-text">{loadingText}</div>
          </div>
        )}

        {/* RESULTS */}
        {view === "results" && (
          <div className="results-scroll" ref={resultsScrollRef}>
            {domainResults.map((dr, i) => (
              <div
                key={i}
                className="domain-block domain-entering"
                style={{
                  animationDelay: `${i * 120}ms`,
                  borderLeft: `2px solid ${dr.color}`,
                  ["--domain-color" as string]: dr.color,
                } as CSSProperties}
              >
                <div className="domain-header">
                  <div className="domain-title-row">
                    <div className="domain-icon-slot">
                      <DomainIcon
                        domain={dr.domain.domain || dr.domain.name || ""}
                        size={36}
                      />
                    </div>
                    <div className="domain-name">
                      {dr.domain.domain || dr.domain.name}
                    </div>
                  </div>
                  <div className="domain-text">
                    <div className="domain-principle">
                      {dr.domain.active_principle || ""}
                    </div>
                    <div className="domain-question">
                      {dr.domain.bridging_question || ""}
                    </div>
                  </div>
                </div>
                <div className="domain-ideas">
                  {dr.ideas.length === 0 ? (
                    <div className="domain-waiting">
                      <span className="loading-dots">awaiting collision</span>
                    </div>
                  ) : (
                    dr.ideas.map((idea, j) => {
                      const name = idea.company_name || idea.name || "Untitled";
                      const slug = collisionSlug(activeBrief || "untitled", name);
                      // Each idea gets its own accent rotated through the palette
                      // domains so a single collision shows variation per company
                      // rather than four cards in one identical shade.
                      const ideaAccent = (() => {
                        const colors = getDomainColors();
                        return colors[(i + j) % colors.length];
                      })();
                      const logo = dr.ideaLogos[j];
                      return (
                      <div
                        key={j}
                        className="idea-card idea-entering"
                        style={{
                          animationDelay: `${j * 80}ms`,
                          ["--idea-accent" as string]: ideaAccent,
                        } as CSSProperties}
                      >
                        <div
                          className={`idea-badge${logo ? " idea-badge-img" : ""}`}
                          aria-hidden="true"
                        >
                          {logo ? (
                            <img src={logo} alt="" />
                          ) : (
                            <span className="idea-badge-icon">
                              <IdeaIcon
                                name={name}
                                tagline={idea.tagline}
                                mechanism={idea.mechanism}
                                domain={dr.domain.domain || dr.domain.name}
                                size={56}
                              />
                            </span>
                          )}
                        </div>
                        <div className="idea-body">
                          <div className="idea-company-name">{name}</div>
                          <div className="idea-tagline">
                            {idea.tagline || ""}
                          </div>
                          <div className="idea-mechanism">{idea.mechanism}</div>
                          <div className="idea-attribution">
                            {idea.attribution || ""}
                          </div>
                        </div>
                        <div className="idea-actions">
                          <Link
                            href={`/c/${slug}`}
                            className="idea-action-btn idea-action-primary"
                            prefetch={false}
                          >
                            Visit site
                            <span className="idea-action-arrow" aria-hidden="true">→</span>
                          </Link>
                          <Link
                            href={`/c/${slug}#merch`}
                            className="idea-action-btn idea-action-secondary"
                            prefetch={false}
                          >
                            <span className="idea-action-icon" aria-hidden="true">🛍</span>
                            Shop merch
                          </Link>
                          <button
                            type="button"
                            className="idea-action-btn idea-action-buy"
                            tabIndex={-1}
                            title="Coming soon"
                          >
                            <span className="idea-action-icon" aria-hidden="true">◈</span>
                            Buy company
                          </button>
                          <button
                            type="button"
                            className="idea-action-btn idea-action-ghost"
                            tabIndex={-1}
                            title="Coming soon"
                          >
                            <span className="idea-action-icon" aria-hidden="true">★</span>
                            Favorite
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {motifModalOpen && (
        <div className="modal-overlay" onClick={() => setMotifModalOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="motif-modal-title"
          >
            <button
              className="modal-close"
              onClick={() => setMotifModalOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <span className="motif-label" id="motif-modal-title">
              SUBMIT AN IDEA FOR LMAO
            </span>
            <p className="modal-hint">
              Enter a motif — we&apos;ll generate 20 briefs around it.
            </p>
            <input
              ref={motifInputRef}
              type="text"
              className="motif-input"
              placeholder="sharks, decay, rebellion..."
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitMotif();
                }
              }}
            />
            <button
              className="modal-submit"
              onClick={submitMotif}
              disabled={regenLoading}
            >
              GENERATE BRIEFS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
