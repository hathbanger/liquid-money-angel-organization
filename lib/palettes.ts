/**
 * @purpose Curated collision palettes — each collision gets its own visual identity.
 *   A palette defines the main accent (drives --accent on .main-panel) plus four
 *   harmonious domain colors. Light and dark variants are tuned independently so
 *   each looks vivid on its own background.
 */

export interface PaletteVariant {
  main: string;
  hover: string;
  soft: string;
  domains: [string, string, string, string];
}

export interface Palette {
  name: string;
  light: PaletteVariant;
  dark: PaletteVariant;
}

export const PALETTES: Palette[] = [
  {
    name: "Sunset Gradient",
    light: {
      main: "#E04000", hover: "#FF5722", soft: "rgba(224,64,0,0.08)",
      domains: ["#E04000", "#FF8A00", "#C70039", "#5E2BFF"],
    },
    dark: {
      main: "#FF5722", hover: "#FF7043", soft: "rgba(255,87,34,0.12)",
      domains: ["#FF5722", "#FFA726", "#FF4081", "#9C7BFF"],
    },
  },
  {
    name: "Cobalt Bloom",
    light: {
      main: "#0050D8", hover: "#1565FF", soft: "rgba(0,80,216,0.08)",
      domains: ["#0050D8", "#D81B60", "#00838F", "#5E9C00"],
    },
    dark: {
      main: "#3B82F6", hover: "#60A5FA", soft: "rgba(59,130,246,0.12)",
      domains: ["#60A5FA", "#F472B6", "#22D3EE", "#A3E635"],
    },
  },
  {
    name: "Verdant Reef",
    light: {
      main: "#00795B", hover: "#009E74", soft: "rgba(0,121,91,0.08)",
      domains: ["#00795B", "#C77800", "#D84A52", "#0E5F76"],
    },
    dark: {
      main: "#10B981", hover: "#34D399", soft: "rgba(16,185,129,0.12)",
      domains: ["#10B981", "#FBBF24", "#FB7185", "#22D3EE"],
    },
  },
  {
    name: "Plum Velvet",
    light: {
      main: "#6B21A8", hover: "#7E22CE", soft: "rgba(107,33,168,0.08)",
      domains: ["#6B21A8", "#BE185D", "#C2410C", "#15803D"],
    },
    dark: {
      main: "#A855F7", hover: "#C084FC", soft: "rgba(168,85,247,0.12)",
      domains: ["#C084FC", "#F472B6", "#FB923C", "#86EFAC"],
    },
  },
  {
    name: "Solar Forge",
    light: {
      main: "#B91C1C", hover: "#DC2626", soft: "rgba(185,28,28,0.08)",
      domains: ["#B91C1C", "#D97706", "#9A3412", "#1F2937"],
    },
    dark: {
      main: "#EF4444", hover: "#F87171", soft: "rgba(239,68,68,0.12)",
      domains: ["#F87171", "#FBBF24", "#FB923C", "#94A3B8"],
    },
  },
  {
    name: "Cyber Pastel",
    light: {
      main: "#DB2777", hover: "#EC4899", soft: "rgba(219,39,119,0.08)",
      domains: ["#DB2777", "#7C3AED", "#0891B2", "#EA580C"],
    },
    dark: {
      main: "#F472B6", hover: "#F9A8D4", soft: "rgba(244,114,182,0.12)",
      domains: ["#F9A8D4", "#C4B5FD", "#67E8F9", "#FDBA74"],
    },
  },
  {
    name: "Bauhaus Primary",
    light: {
      main: "#E11D48", hover: "#F43F5E", soft: "rgba(225,29,72,0.08)",
      domains: ["#E11D48", "#1D4ED8", "#CA8A04", "#171717"],
    },
    dark: {
      main: "#F43F5E", hover: "#FB7185", soft: "rgba(244,63,94,0.12)",
      domains: ["#FB7185", "#60A5FA", "#FDE047", "#E5E5E5"],
    },
  },
  {
    name: "Tropical Storm",
    light: {
      main: "#0E7490", hover: "#0891B2", soft: "rgba(14,116,144,0.08)",
      domains: ["#0E7490", "#DB2777", "#CA8A04", "#1E1B4B"],
    },
    dark: {
      main: "#22D3EE", hover: "#67E8F9", soft: "rgba(34,211,238,0.12)",
      domains: ["#22D3EE", "#F472B6", "#FDE047", "#A78BFA"],
    },
  },
  {
    name: "Forest Floor",
    light: {
      main: "#166534", hover: "#15803D", soft: "rgba(22,101,52,0.08)",
      domains: ["#166534", "#A16207", "#9A3412", "#312E81"],
    },
    dark: {
      main: "#4ADE80", hover: "#86EFAC", soft: "rgba(74,222,128,0.12)",
      domains: ["#86EFAC", "#FBBF24", "#FB923C", "#A5B4FC"],
    },
  },
  {
    name: "Vapor Wave",
    light: {
      main: "#C026D3", hover: "#D946EF", soft: "rgba(192,38,211,0.08)",
      domains: ["#C026D3", "#0891B2", "#7C3AED", "#65A30D"],
    },
    dark: {
      main: "#E879F9", hover: "#F0ABFC", soft: "rgba(232,121,249,0.12)",
      domains: ["#F0ABFC", "#67E8F9", "#C4B5FD", "#BEF264"],
    },
  },
  {
    name: "Espresso & Cream",
    light: {
      main: "#78350F", hover: "#92400E", soft: "rgba(120,53,15,0.08)",
      domains: ["#78350F", "#A16207", "#9F1239", "#1F2937"],
    },
    dark: {
      main: "#D6A77A", hover: "#E7C49A", soft: "rgba(214,167,122,0.14)",
      domains: ["#E7C49A", "#FCD34D", "#FCA5A5", "#D1D5DB"],
    },
  },
  {
    name: "Ice Age",
    light: {
      main: "#1E40AF", hover: "#2563EB", soft: "rgba(30,64,175,0.08)",
      domains: ["#1E40AF", "#0E7490", "#7C3AED", "#475569"],
    },
    dark: {
      main: "#93C5FD", hover: "#BFDBFE", soft: "rgba(147,197,253,0.14)",
      domains: ["#BFDBFE", "#A5F3FC", "#DDD6FE", "#CBD5E1"],
    },
  },
];

export const DEFAULT_LIGHT_DOMAINS: [string, string, string, string] = [
  "#00994D", "#E04000", "#0066DD", "#7733CC",
];
export const DEFAULT_DARK_DOMAINS: [string, string, string, string] = [
  "#00CC66", "#FF4F00", "#0088FF", "#AA44FF",
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteForBrief(brief: string): Palette {
  return PALETTES[hash(brief.trim().toLowerCase()) % PALETTES.length];
}
