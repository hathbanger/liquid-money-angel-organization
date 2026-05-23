/**
 * @purpose Concept-aware SVG icon library for idea badges. Each glyph is tagged
 *   with keywords; iconForIdea() picks the best match against the company name,
 *   tagline, mechanism, and domain. Strokes use currentColor so the parent's
 *   accent color cascades cleanly. Falls back to a deterministic hash-pick if
 *   no keyword matches so EVERY card still gets a recognisable mark.
 *
 *   Icons expose their inner `<path>` JSX (no `<svg>` wrapper) so they can be
 *   embedded inside another SVG (e.g. as the print on a merch mockup) via a
 *   `<g transform="translate(x, y) scale(...)">`.
 */
import React from "react";

interface ConceptIcon {
  id: string;
  keywords: string[];
  paths: React.ReactNode;
  strokeWidth: number;
}

const i = (
  id: string,
  keywords: string[],
  paths: React.ReactNode,
  strokeWidth = 1.75,
): ConceptIcon => ({ id, keywords, paths, strokeWidth });

const ICONS: ConceptIcon[] = [
  i("snowflake",
    ["ice", "cryo", "freeze", "frost", "cold", "snow", "glacier", "winter", "polar", "arctic", "chill"],
    <>
      <path d="M24 4v40 M4 24h40 M9 9l30 30 M9 39l30-30" />
      <path d="M24 10l-4-4M24 10l4-4 M24 38l-4 4M24 38l4 4 M10 24l-4-4M10 24l-4 4 M38 24l4-4M38 24l4 4" />
    </>),
  i("flame",
    ["fire", "flame", "burn", "hot", "heat", "blaze", "torch", "spark", "ember", "lava", "viral"],
    <path d="M24 4c4 8 12 12 12 22a12 12 0 1 1-24 0c0-6 4-8 6-12 1 4 4 6 6 6 0-6-4-10 0-16z" />,
    2),
  i("wave",
    ["wave", "water", "ocean", "fluid", "liquid", "tide", "surf", "ripple", "flow", "stream", "current"],
    <>
      <path d="M4 32q4-6 8-6t8 6 8 6 8-6 8-6" />
      <path d="M4 22q4-6 8-6t8 6 8 6 8-6 8-6" />
      <path d="M4 12q4-6 8-6t8 6 8 6 8-6 8-6" />
    </>),
  i("gradient",
    ["gradient", "spectrum", "fade", "blend", "color", "prism", "rainbow", "hue", "tint"],
    <>
      <rect x="6" y="10" width="36" height="28" rx="4" />
      <path d="M6 38L42 10" />
      <path d="M6 28L32 10" />
      <path d="M16 38L42 20" />
    </>),
  i("lightning",
    ["lightning", "bolt", "thunder", "electric", "power", "energy", "shock", "charge", "voltage", "storm"],
    <polygon points="26,4 10,28 22,28 18,44 38,20 26,20" />),
  i("leaf",
    ["leaf", "plant", "green", "eco", "nature", "organic", "bio", "growth", "garden", "park", "tree", "botanic"],
    <>
      <path d="M40 8c-4 18-12 32-32 32 0-20 14-32 32-32z" />
      <path d="M14 38l16-16" />
    </>),
  i("sun",
    ["sun", "solar", "bright", "day", "light", "shine", "gold", "morning", "dawn", "summer"],
    <>
      <circle cx="24" cy="24" r="8" />
      <path d="M24 4v6 M24 38v6 M4 24h6 M38 24h6 M10 10l4 4 M34 34l4 4 M38 10l-4 4 M14 34l-4 4" />
    </>),
  i("moon",
    ["moon", "night", "dark", "sleep", "dream", "lunar", "midnight", "evening", "rest"],
    <path d="M34 28a14 14 0 1 1-14-22 11 11 0 0 0 14 22z" />,
    2),
  i("star",
    ["star", "favorite", "loyalty", "rating", "review", "reward", "shine", "premium", "vip"],
    <polygon points="24,4 30,18 44,18 33,28 37,42 24,34 11,42 15,28 4,18 18,18" />),
  i("mountain",
    ["mountain", "peak", "summit", "hike", "alpine", "climb", "altitude", "elevation", "ridge"],
    <>
      <polyline points="4,40 16,20 22,30 30,12 44,40" />
      <path d="M4 40h40" />
    </>),
  i("cloud",
    ["cloud", "sky", "saas", "fog", "mist", "vapor", "host", "storage", "weather"],
    <path d="M14 34a8 8 0 1 1 2-15 10 10 0 0 1 19 3 7 7 0 0 1-1 14H14a4 4 0 0 1 0-8" />),
  i("dna",
    ["dna", "gene", "genetic", "biology", "enzymatic", "enzyme", "cell", "molecule", "helix", "lab"],
    <>
      <path d="M12 6c0 12 24 18 24 36" />
      <path d="M36 6c0 12-24 18-24 36" />
      <path d="M14 14h20 M14 24h20 M14 34h20" />
    </>),
  i("brain",
    ["brain", "mind", "think", "neural", "ai", "intelligence", "neuron", "cognitive", "learn", "math", "education", "smart"],
    <>
      <path d="M22 8a8 8 0 0 0-8 8 8 8 0 0 0-2 14 8 8 0 0 0 10 10v-32z" />
      <path d="M26 8a8 8 0 0 1 8 8 8 8 0 0 1 2 14 8 8 0 0 1-10 10v-32z" />
      <path d="M22 16h4 M22 24h4 M22 32h4" />
    </>),
  i("eye",
    ["eye", "vision", "see", "watch", "surveil", "view", "observe", "look", "iris", "spectacle", "stealth"],
    <>
      <path d="M4 24c4-10 12-14 20-14s16 4 20 14c-4 10-12 14-20 14S8 34 4 24z" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
    </>),
  i("heart",
    ["heart", "love", "care", "health", "medical", "wellness", "cardio", "feeling", "emotion"],
    <path d="M24 42 C8 30 4 20 12 12 c5-5 12-2 12 4 c0-6 7-9 12-4 c8 8 4 18-12 30z" />),
  i("flower",
    ["flower", "bloom", "petal", "garden", "spring", "rose", "blossom", "floral"],
    <>
      <circle cx="24" cy="24" r="4" />
      <circle cx="24" cy="12" r="6" />
      <circle cx="24" cy="36" r="6" />
      <circle cx="12" cy="24" r="6" />
      <circle cx="36" cy="24" r="6" />
    </>),
  i("mushroom",
    ["mushroom", "fungus", "mycel", "shroom", "spore"],
    <>
      <path d="M8 22a16 10 0 0 1 32 0 z" />
      <path d="M18 22v14a6 6 0 0 0 12 0V22" />
      <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
      <circle cx="28" cy="14" r="2" fill="currentColor" stroke="none" />
    </>),
  i("salt",
    ["salt", "season", "spice", "cure", "cured", "preserve", "pepper", "grain", "crystal", "kosher", "brine", "meat", "meats"],
    <>
      <path d="M16 8h16l-2 8H18z" />
      <path d="M18 16v20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V16" />
      <path d="M18 24h12 M18 32h12" />
      <circle cx="22" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="26" cy="6" r="1" fill="currentColor" stroke="none" />
    </>),
  i("chef-fork",
    ["food", "menu", "dietary", "eat", "meal", "kitchen", "chef", "cook", "fork", "diet", "restaurant", "dish"],
    <>
      <path d="M14 6v18a4 4 0 0 0 4 4h0v14" />
      <path d="M22 6v18" />
      <path d="M18 6v12" />
      <path d="M34 6c-4 0-6 4-6 10 0 4 2 6 4 6v20" />
    </>),
  i("wheat",
    ["wheat", "grain", "bread", "farm", "harvest", "agriculture", "field"],
    <>
      <path d="M24 8v36" />
      <path d="M24 16l-6-4M24 16l6-4 M24 22l-6-4M24 22l6-4 M24 28l-6-4M24 28l6-4 M24 34l-6-4M24 34l6-4" />
    </>),
  i("chip",
    ["chip", "cpu", "silicon", "hardware", "circuit", "processor", "soc", "embedded"],
    <>
      <rect x="14" y="14" width="20" height="20" rx="2" />
      <path d="M6 18h8 M6 24h8 M6 30h8 M34 18h8 M34 24h8 M34 30h8 M18 6v8 M24 6v8 M30 6v8 M18 34v8 M24 34v8 M30 34v8" />
      <rect x="20" y="20" width="8" height="8" />
    </>),
  i("terminal",
    ["terminal", "cli", "code", "command", "shell", "console", "developer", "dev", "bash", "script", "github"],
    <>
      <rect x="4" y="8" width="40" height="32" rx="3" />
      <polyline points="12,18 18,24 12,30" />
      <line x1="22" y1="32" x2="34" y2="32" />
    </>),
  i("spiral",
    ["spiral", "viral", "twist", "loop", "vortex", "swirl", "cycle", "rotate", "spin"],
    <path d="M24 4a20 20 0 1 1-14 34 14 14 0 0 1 12-24 10 10 0 0 1 8 16 6 6 0 0 1-10-4" />),
  i("rocket",
    ["rocket", "launch", "ship", "boost", "startup", "lift", "space", "fast", "growth", "scale"],
    <>
      <path d="M24 4c8 6 12 14 12 22v8H12v-8c0-8 4-16 12-22z" />
      <circle cx="24" cy="20" r="3" />
      <path d="M12 30l-6 8h8 M36 30l6 8h-8" />
      <path d="M20 38v4 M24 38v6 M28 38v4" />
    </>),
  i("antenna",
    ["antenna", "signal", "broadcast", "livestream", "stream", "transmit", "wireless", "radio", "podcast", "talk", "talks", "conference"],
    <>
      <line x1="24" y1="22" x2="24" y2="42" />
      <path d="M16 22a8 8 0 0 1 16 0" />
      <path d="M10 22a14 14 0 0 1 28 0" />
      <path d="M4 22a20 20 0 0 1 40 0" />
      <circle cx="24" cy="22" r="2" fill="currentColor" stroke="none" />
    </>),
  i("satellite",
    ["satellite", "orbit", "remote", "telemetry", "gps"],
    <>
      <rect x="20" y="20" width="8" height="8" transform="rotate(45 24 24)" />
      <path d="M8 8l8 8 M40 40l-8-8 M40 8l-8 8 M8 40l8-8" />
      <path d="M30 30a8 8 0 0 1-12 0" />
    </>),
  i("robot",
    ["robot", "agent", "android", "machine", "automation", "bot"],
    <>
      <rect x="10" y="14" width="28" height="22" rx="3" />
      <line x1="24" y1="14" x2="24" y2="8" />
      <circle cx="24" cy="6" r="2" />
      <circle cx="18" cy="24" r="2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="24" r="2" fill="currentColor" stroke="none" />
      <path d="M18 32h12" />
      <line x1="10" y1="22" x2="6" y2="22" />
      <line x1="38" y1="22" x2="42" y2="22" />
    </>),
  i("key",
    ["key", "auth", "wallet", "crypto", "secret", "private", "credential", "vault"],
    <>
      <circle cx="14" cy="24" r="8" />
      <path d="M22 24h22" />
      <path d="M34 24v6 M40 24v8" />
    </>),
  i("lock",
    ["lock", "secure", "trust", "safety", "protect", "shield", "guard", "privacy"],
    <>
      <rect x="10" y="22" width="28" height="20" rx="2" />
      <path d="M16 22v-6a8 8 0 0 1 16 0v6" />
      <circle cx="24" cy="32" r="2" />
      <line x1="24" y1="32" x2="24" y2="38" />
    </>),
  i("coin",
    ["coin", "money", "cash", "currency", "dollar", "finance", "payment", "wallet", "crypto", "bitcoin"],
    <>
      <circle cx="24" cy="24" r="16" />
      <path d="M20 18h6a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h6" />
      <line x1="24" y1="14" x2="24" y2="18" />
      <line x1="24" y1="34" x2="24" y2="38" />
    </>),
  i("chart",
    ["chart", "graph", "trend", "metric", "analytics", "data", "stats", "growth", "decline", "churn", "report"],
    <>
      <polyline points="6,38 18,26 26,30 42,10" />
      <line x1="6" y1="42" x2="42" y2="42" />
      <line x1="6" y1="42" x2="6" y2="8" />
    </>),
  i("scale",
    ["scale", "balance", "fair", "equal", "vote", "voting", "polarization", "polarized", "polar", "justice", "law", "weigh", "compare"],
    <>
      <line x1="24" y1="6" x2="24" y2="42" />
      <line x1="14" y1="42" x2="34" y2="42" />
      <line x1="8" y1="14" x2="40" y2="14" />
      <path d="M8 14l-4 10a4 4 0 0 0 8 0z" />
      <path d="M40 14l-4 10a4 4 0 0 0 8 0z" />
    </>),
  i("bank",
    ["bank", "vault", "treasury", "institution", "ledger", "deposit", "savings"],
    <>
      <polygon points="4,18 24,6 44,18" />
      <line x1="4" y1="22" x2="44" y2="22" />
      <line x1="10" y1="22" x2="10" y2="36" />
      <line x1="18" y1="22" x2="18" y2="36" />
      <line x1="30" y1="22" x2="30" y2="36" />
      <line x1="38" y1="22" x2="38" y2="36" />
      <line x1="4" y1="40" x2="44" y2="40" />
    </>),
  i("gear",
    ["gear", "cog", "settings", "config", "mechanic", "mechanism", "engine", "industrial", "factory", "process"],
    <>
      <path d="M24 6v6 M24 36v6 M6 24h6 M36 24h6 M11 11l4 4 M33 33l4 4 M37 11l-4 4 M15 33l-4 4" />
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="5" />
    </>),
  i("wrench",
    ["wrench", "fix", "repair", "tool", "maintenance", "service"],
    <path d="M28 4a8 8 0 0 0-4 14l-18 18a3 3 0 0 0 4 4l18-18a8 8 0 0 0 10-10l-6 6-4-4z" />),
  i("magnet",
    ["magnet", "attract", "pull", "magnetic", "draw"],
    <>
      <path d="M10 8h8v18a6 6 0 0 0 12 0V8h8v18a14 14 0 0 1-28 0z" />
      <line x1="10" y1="14" x2="18" y2="14" />
      <line x1="30" y1="14" x2="38" y2="14" />
    </>),
  i("chat",
    ["chat", "talk", "speak", "message", "conversation", "interview", "ask", "dialog", "comment", "community", "social"],
    <>
      <path d="M6 10h36v22H22l-10 10v-10H6z" />
      <line x1="14" y1="18" x2="34" y2="18" />
      <line x1="14" y1="24" x2="28" y2="24" />
    </>),
  i("mic",
    ["mic", "microphone", "voice", "record", "podcast", "audio", "say"],
    <>
      <rect x="18" y="6" width="12" height="22" rx="6" />
      <path d="M10 22a14 14 0 0 0 28 0" />
      <line x1="24" y1="36" x2="24" y2="42" />
      <line x1="16" y1="42" x2="32" y2="42" />
    </>),
  i("headphones",
    ["music", "headphone", "spotify", "audio", "listen", "tune", "song", "track", "playlist"],
    <>
      <path d="M8 28v-2a16 16 0 0 1 32 0v2" />
      <rect x="6" y="28" width="8" height="14" rx="2" />
      <rect x="34" y="28" width="8" height="14" rx="2" />
    </>),
  i("book",
    ["book", "read", "reading", "novel", "library", "study", "literature", "long-form", "knowledge"],
    <>
      <path d="M8 8h14a6 6 0 0 1 6 6v28a6 6 0 0 0-6-6H8z" />
      <path d="M40 8H26a6 6 0 0 0-6 6v28a6 6 0 0 1 6-6h14z" />
    </>),
  i("fork",
    ["fork", "git", "branch", "merge", "split", "pr", "pull request", "contributor", "open source"],
    <>
      <circle cx="14" cy="10" r="4" />
      <circle cx="34" cy="10" r="4" />
      <circle cx="24" cy="38" r="4" />
      <path d="M14 14v4a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-4" />
      <line x1="24" y1="24" x2="24" y2="34" />
    </>),
  i("bug",
    ["bug", "debug", "error", "fail", "broken", "issue", "defect", "review"],
    <>
      <ellipse cx="24" cy="26" rx="10" ry="12" />
      <line x1="14" y1="26" x2="6" y2="26" />
      <line x1="34" y1="26" x2="42" y2="26" />
      <line x1="14" y1="18" x2="8" y2="14" />
      <line x1="34" y1="18" x2="40" y2="14" />
      <line x1="14" y1="34" x2="8" y2="38" />
      <line x1="34" y1="34" x2="40" y2="38" />
      <line x1="20" y1="14" x2="20" y2="10" />
      <line x1="28" y1="14" x2="28" y2="10" />
    </>),
  i("dumbbell",
    ["gym", "fitness", "weight", "lift", "workout", "exercise", "muscle", "training", "sport"],
    <>
      <rect x="2" y="18" width="6" height="12" rx="1" />
      <rect x="40" y="18" width="6" height="12" rx="1" />
      <rect x="8" y="20" width="4" height="8" />
      <rect x="36" y="20" width="4" height="8" />
      <line x1="12" y1="24" x2="36" y2="24" />
    </>),
  i("clock",
    ["clock", "time", "timer", "schedule", "deadline", "late", "no-show", "appointment", "hour"],
    <>
      <circle cx="24" cy="24" r="18" />
      <polyline points="24,12 24,24 32,30" />
    </>),
  i("calendar",
    ["calendar", "date", "month", "event", "agenda", "booking"],
    <>
      <rect x="6" y="10" width="36" height="32" rx="3" />
      <line x1="6" y1="20" x2="42" y2="20" />
      <line x1="16" y1="6" x2="16" y2="14" />
      <line x1="32" y1="6" x2="32" y2="14" />
      <circle cx="16" cy="28" r="2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="28" r="2" fill="currentColor" stroke="none" />
      <circle cx="32" cy="28" r="2" fill="currentColor" stroke="none" />
    </>),
  i("skull",
    ["skull", "dead", "die", "death", "doom", "kill", "ignore", "ignoring", "tombstone", "rip", "crushing", "soul"],
    <>
      <path d="M10 22a14 14 0 0 1 28 0v8a4 4 0 0 1-4 4h-4v6h-12v-6h-4a4 4 0 0 1-4-4z" />
      <circle cx="18" cy="24" r="3" fill="currentColor" stroke="none" />
      <circle cx="30" cy="24" r="3" fill="currentColor" stroke="none" />
      <line x1="22" y1="32" x2="22" y2="34" />
      <line x1="26" y1="32" x2="26" y2="34" />
    </>),
  i("ghost",
    ["ghost", "phantom", "spectre", "spirit", "haunt", "absence", "missing", "churn"],
    <>
      <path d="M10 22a14 14 0 0 1 28 0v20l-6-4-4 4-4-4-4 4-4-4-6 4z" />
      <circle cx="18" cy="22" r="2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="22" r="2" fill="currentColor" stroke="none" />
    </>),
  i("shield",
    ["shield", "defend"],
    <>
      <path d="M24 4l16 6v14c0 12-8 18-16 20-8-2-16-8-16-20V10z" />
      <polyline points="16,22 22,28 32,18" />
    </>),
  i("handshake",
    ["handshake", "deal", "agreement", "partnership", "collaborate", "shake", "gap"],
    <>
      <path d="M4 20l8 12 8-4 4 4 4-4 8 4 8-12" />
      <path d="M14 30l6-6 4 2 4-2 6 6" />
    </>),
  i("stall",
    ["market", "marketplace", "stall", "store", "shop", "vendor", "kiosk", "bazaar", "cold-start"],
    <>
      <path d="M6 18l4-10h28l4 10z" />
      <line x1="6" y1="18" x2="42" y2="18" />
      <line x1="10" y1="18" x2="10" y2="40" />
      <line x1="38" y1="18" x2="38" y2="40" />
      <line x1="6" y1="40" x2="42" y2="40" />
      <rect x="18" y="22" width="12" height="10" />
    </>),
  i("grid",
    ["grid", "matrix", "enterprise", "dashboard", "panel", "layout", "table", "structure", "system", "ux"],
    <>
      <rect x="6" y="6" width="14" height="14" />
      <rect x="28" y="6" width="14" height="14" />
      <rect x="6" y="28" width="14" height="14" />
      <rect x="28" y="28" width="14" height="14" />
    </>),
  i("bubble",
    ["bubble", "taste", "filter", "ball", "sphere", "orb", "preference"],
    <>
      <circle cx="18" cy="20" r="12" />
      <circle cx="34" cy="32" r="8" />
      <circle cx="14" cy="36" r="4" />
      <circle cx="14" cy="14" r="2" fill="currentColor" stroke="none" />
      <circle cx="32" cy="28" r="1.5" fill="currentColor" stroke="none" />
    </>),
  i("broadcast",
    ["broadcast", "tv", "media", "channel", "publish", "newscast", "news"],
    <>
      <rect x="6" y="18" width="36" height="22" rx="2" />
      <line x1="14" y1="6" x2="20" y2="18" />
      <line x1="34" y1="6" x2="28" y2="18" />
      <circle cx="24" cy="29" r="6" />
    </>),
  i("swap",
    ["swap", "exchange", "trade", "convert", "switch", "transfer", "send", "payment", "payments"],
    <>
      <polyline points="8,16 4,20 8,24" />
      <line x1="4" y1="20" x2="40" y2="20" />
      <polyline points="40,32 44,28 40,24" />
      <line x1="44" y1="28" x2="8" y2="28" />
    </>),
  i("puzzle",
    ["puzzle", "piece", "fit", "solve", "modular", "integration", "onboarding"],
    <path d="M8 8h12v6a4 4 0 0 0 8 0V8h12v12h-6a4 4 0 0 0 0 8h6v12H28v-6a4 4 0 0 0-8 0v6H8V28h6a4 4 0 0 0 0-8H8z" />),
  i("drop",
    ["drop", "drip", "splash", "tear", "rain", "ink", "blood"],
    <path d="M24 4 C14 16 10 24 10 30 a14 14 0 0 0 28 0 c0-6-4-14-14-26z" />),
  i("sparkle",
    ["sparkle", "shine", "magic", "glitter", "twinkle", "wow", "delight"],
    <>
      <path d="M24 6l4 14 14 4-14 4-4 14-4-14-14-4 14-4z" />
      <path d="M38 36l1 4 4 1-4 1-1 4-1-4-4-1 4-1z" />
      <path d="M10 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
    </>),
  i("globe",
    ["globe", "world", "earth", "planet", "global", "international", "geo", "country"],
    <>
      <circle cx="24" cy="24" r="18" />
      <ellipse cx="24" cy="24" rx="8" ry="18" />
      <line x1="6" y1="24" x2="42" y2="24" />
    </>),
  i("rss",
    ["feed", "rss", "subscribe", "follow", "blog", "newsletter"],
    <>
      <path d="M8 10a30 30 0 0 1 30 30" />
      <path d="M8 20a20 20 0 0 1 20 20" />
      <circle cx="10" cy="38" r="3" fill="currentColor" stroke="none" />
    </>),
];

const FALLBACK_ICONS: ConceptIcon[] = ICONS.slice(0, 16);

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickIcon(
  name: string,
  context: { tagline?: string; mechanism?: string; domain?: string } = {},
): ConceptIcon {
  const haystack = [
    name,
    context.tagline ?? "",
    context.mechanism ?? "",
    context.domain ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let best: ConceptIcon | null = null;
  let bestScore = 0;
  for (const icon of ICONS) {
    let score = 0;
    for (const kw of icon.keywords) {
      if (haystack.includes(kw)) {
        score += kw.length + (haystack.split(kw).length - 1);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = icon;
    }
  }

  if (best) return best;
  return FALLBACK_ICONS[hash(name || "x") % FALLBACK_ICONS.length];
}

export function IdeaIcon({
  name,
  tagline,
  mechanism,
  domain,
  size = 40,
}: {
  name: string;
  tagline?: string;
  mechanism?: string;
  domain?: string;
  size?: number;
}) {
  const icon = pickIcon(name, { tagline, mechanism, domain });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon.paths}
    </svg>
  );
}

/**
 * Returns just the icon's inner paths (no <svg> wrapper) so the caller can
 * embed it inside another SVG with a transform — e.g. as the print artwork on
 * a merch mockup. The caller supplies the stroke / fill via CSS currentColor.
 */
export function getIdeaIconPaths(
  name: string,
  context: { tagline?: string; mechanism?: string; domain?: string } = {},
): { paths: React.ReactNode; strokeWidth: number } {
  const icon = pickIcon(name, context);
  return { paths: icon.paths, strokeWidth: icon.strokeWidth };
}
