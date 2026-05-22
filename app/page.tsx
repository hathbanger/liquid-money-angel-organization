'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const DOMAIN_COLORS_LIGHT = ['#00994D', '#E04000', '#0066DD', '#7733CC'];
const DOMAIN_COLORS_DARK = ['#00CC66', '#FF4F00', '#0088FF', '#AA44FF'];

const DEFAULT_BRIEFS = [
  'crypto wallet onboarding',
  'soul-crushing code review',
  'job interviews that predict nothing',
  'viral CLI tools',
  'Spotify taste bubbles',
  'medical no-shows',
  'first-PR contributor churn',
  'loyalty programs feel like scams',
  'teenagers ignoring finance',
  'conference talks AI era',
  'agent payments trust gap',
  'marketplace cold-start',
  'parks against loneliness',
  'long-form reading addiction',
  'dev communities dying post-launch',
  'stealth math education',
  'anti-polarization voting',
  'enterprise UX that doesn\'t suck',
  'menus for dietary chaos',
  'unused gym memberships',
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [briefs, setBriefs] = useState<string[]>(DEFAULT_BRIEFS);
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [briefsFading, setBriefsFading] = useState(false);
  const [briefsInitialLoading, setBriefsInitialLoading] = useState(false);

  // Main panel state
  const [activeBrief, setActiveBrief] = useState('');
  const [statusText, setStatusText] = useState('');
  const [view, setView] = useState<'empty' | 'loading' | 'results'>('empty');
  const [loadingText, setLoadingText] = useState('colliding domains');
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [mobileResults, setMobileResults] = useState(false);

  const domainsRef = useRef<Domain[]>([]);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  // Theme init from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('oc-theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('oc-theme', next);
      return next;
    });
  }, []);

  const getDomainColors = useCallback(() => {
    return theme === 'dark' ? DOMAIN_COLORS_DARK : DOMAIN_COLORS_LIGHT;
  }, [theme]);

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
    await new Promise(r => setTimeout(r, 200));
    setBriefsFading(false);
    setBriefsInitialLoading(true);
    setBriefs([]);

    try {
      const res = await fetch('/api/regen-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: motif.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBriefs(data.briefs);
    } catch (err) {
      console.error('Regen error:', err);
      setBriefs([]);
    } finally {
      setRegenLoading(false);
      setBriefsInitialLoading(false);
    }
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
    setView('loading');
    setLoadingText('generating distant domains');
    setDomainResults([]);
    setStatusText('');
    domainsRef.current = [];

    try {
      const res = await fetch('/api/collide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            handleEvent(JSON.parse(raw));
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      setStatusText(`Error: ${(err as Error).message}`);
    }
  }

  function handleEvent(msg: Record<string, unknown>) {
    if (msg.type === 'status') {
      setLoadingText((msg.message as string).toLowerCase().replace(/\.+$/, ''));
    }

    if (msg.type === 'domains') {
      const domains = msg.domains as Domain[];
      domainsRef.current = domains;
      const colors = getDomainColors();
      setView('results');
      setDomainResults(domains.map((d, i) => ({
        domain: d,
        color: colors[i % colors.length],
        ideas: [],
        domainLogo: null,
        ideaLogos: [],
      })));
      setStatusText(`${domains.length} domains found — colliding...`);
    }

    if (msg.type === 'domain-logos') {
      const logos = msg.logos as (string | null)[];
      setDomainResults(prev => prev.map((dr, i) => ({
        ...dr,
        domainLogo: logos[i] || dr.domainLogo,
      })));
    }

    if (msg.type === 'collision') {
      const idx = msg.domainIndex as number;
      const ideas = msg.ideas as Idea[];
      setDomainResults(prev => prev.map((dr, i) =>
        i === idx ? { ...dr, ideas, ideaLogos: ideas.map(() => null) } : dr
      ));
      // Update status
      setDomainResults(prev => {
        const filledCount = prev.reduce((acc, dr) => acc + dr.ideas.length, 0);
        const remaining = prev.filter(dr => dr.ideas.length === 0).length;
        if (remaining > 0) {
          setStatusText(`${filledCount} ideas — ${remaining} domain${remaining > 1 ? 's' : ''} remaining...`);
        }
        return prev;
      });
    }

    if (msg.type === 'idea-logos') {
      const idx = msg.domainIndex as number;
      const logos = msg.logos as (string | null)[];
      setDomainResults(prev => prev.map((dr, i) =>
        i === idx ? { ...dr, ideaLogos: logos } : dr
      ));
    }

    if (msg.type === 'done') {
      setDomainResults(prev => {
        const ideaCount = prev.reduce((acc, dr) => acc + dr.ideas.length, 0);
        setStatusText(`${ideaCount} ideas from ${prev.length} domains`);
        return prev;
      });
    }

    if (msg.type === 'error') {
      setView('results');
      setStatusText(`error: ${msg.message}`);
    }
  }

  return (
    <div className={`layout${mobileResults ? ' mobile-results' : ''}`}>
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <h1>LIQUID MONEY <span>ANGEL ORGANIZATION</span></h1>
            <div className="tagline">bisociation engine</div>
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title="Toggle light/dark mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <div className="motif-section">
          <span className="motif-label">SUBMIT AN IDEA FOR LMAO</span>
          <input
            type="text"
            className="motif-input"
            placeholder="sharks, decay, rebellion..."
            value={motif}
            onChange={e => setMotif(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); regenExamples(); }
            }}
          />
        </div>
        <div className="regen-row">
          <button
            className={`regen-btn${regenLoading ? ' spinning' : ''}`}
            onClick={regenExamples}
            disabled={regenLoading}
          >
            <span className="regen-icon">↻</span> NEW BRIEFS
          </button>
        </div>
        <div className="briefs-scroll">
          <div className={`examples-grid${briefsFading ? ' fading' : ''}`}>
            {briefsInitialLoading ? (
              <div className="briefs-loader">
                <div className="briefs-loader-dots">
                  <span></span><span></span><span></span>
                </div>
                <div className="briefs-loader-text">generating briefs</div>
              </div>
            ) : briefs.length === 0 && !briefsInitialLoading ? (
              <div className="briefs-loader">
                <div className="briefs-loader-text">failed to load — try again</div>
              </div>
            ) : (
              briefs.map((brief, i) => (
                <button
                  key={`${brief}-${i}`}
                  className={`example-btn fade-in${selectedBrief === brief ? ' selected' : ''}`}
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
      <div className="main-panel">
        <div className="main-header">
          <button className="back-btn" onClick={goBack}>← BRIEFS</button>
          {activeBrief && (
            <>
              <span className="active-brief-label">COLLIDING:</span>
              <span className="active-brief-text">{activeBrief}</span>
            </>
          )}
          {statusText && <span className="status">{statusText}</span>}
        </div>

        {/* EMPTY STATE */}
        {view === 'empty' && (
          <div className="empty-state">
            <div className="empty-hero-anim">
              <div className="orbit"></div>
              <div className="orbit"></div>
              <div className="orbit"></div>
              <div className="core"></div>
            </div>
            <div className="empty-title">Collide distant ideas</div>
            <div className="empty-subtitle">
              Pick a brief from the left. We&apos;ll smash it against 4 unrelated knowledge domains
              and generate startup ideas that could only exist at the intersection.
            </div>
            <div className="empty-how">
              <div className="empty-step">
                <div className="empty-step-num">1</div>
                <div className="empty-step-text">Pick a brief or type a motif</div>
              </div>
              <div className="empty-step">
                <div className="empty-step-num">2</div>
                <div className="empty-step-text">We find 4 distant domains</div>
              </div>
              <div className="empty-step">
                <div className="empty-step-num">3</div>
                <div className="empty-step-text">Ideas emerge from collisions</div>
              </div>
            </div>
            <button className="empty-try-btn" onClick={tryRandom}>⚡ Try a random brief</button>
            <div className="empty-footnote">Powered by bisociation — Arthur Koestler&apos;s theory of creative leaps</div>
          </div>
        )}

        {/* LOADING STATE */}
        {view === 'loading' && (
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
        {view === 'results' && (
          <div className="results-scroll" ref={resultsScrollRef}>
            {domainResults.map((dr, i) => (
              <div
                key={i}
                className="domain-block domain-entering"
                style={{ animationDelay: `${i * 120}ms`, borderLeft: `2px solid ${dr.color}` }}
              >
                <div className="domain-header">
                  <div className={`domain-logo-slot${dr.domainLogo ? ' loaded' : ''}`}>
                    {dr.domainLogo ? (
                      <img src={dr.domainLogo} alt="domain logo" />
                    ) : (
                      <div className="domain-logo-placeholder"></div>
                    )}
                  </div>
                  <div className="domain-info">
                    <div className="domain-name" style={{ color: dr.color }}>
                      {dr.domain.domain || dr.domain.name}
                    </div>
                    <div className="domain-principle">{dr.domain.active_principle || ''}</div>
                    <div className="domain-question">{dr.domain.bridging_question || ''}</div>
                  </div>
                </div>
                <div className="domain-ideas">
                  {dr.ideas.length === 0 ? (
                    <div className="domain-waiting">
                      <span className="loading-dots">awaiting collision</span>
                    </div>
                  ) : (
                    dr.ideas.map((idea, j) => (
                      <div
                        key={j}
                        className="idea-card idea-entering"
                        style={{ animationDelay: `${j * 80}ms` }}
                      >
                        <div className={`idea-logo-slot${dr.ideaLogos[j] ? ' loaded' : ''}`}>
                          {dr.ideaLogos[j] ? (
                            <img src={dr.ideaLogos[j]!} alt="idea logo" />
                          ) : (
                            <div className="domain-logo-placeholder"></div>
                          )}
                        </div>
                        <div className="idea-body">
                          <div className="idea-company-name">
                            {idea.company_name || idea.name || 'Untitled'}
                          </div>
                          <div className="idea-tagline">{idea.tagline || ''}</div>
                          <div className="idea-mechanism">{idea.mechanism}</div>
                          <div className="idea-attribution">{idea.attribution || ''}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
