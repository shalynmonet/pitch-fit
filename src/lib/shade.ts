// Derives a simple warm/cool + depth label from a detected skin-color hex value.
// YouCam's AI Facial Color Tones Analyzer returns raw hex colors only — no categorical
// "tone/undertone" field — so this is PitchFit's own estimate, not an API-provided value.

export type ShadeTone = "warm" | "cool" | "neutral";
export type ShadeDepth = "light" | "medium" | "deep";

export interface ShadeMatch {
  hex: string;
  tone: ShadeTone;
  depth: ShadeDepth;
  label: string;
  pitchLine: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, l * 100];

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;

  return [h, s, l * 100];
}

export function deriveShadeMatch(hex: string | null | undefined): ShadeMatch | null {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return null;

  const [r, g, b] = hexToRgb(hex);
  const [h, , l] = rgbToHsl(r, g, b);

  let tone: ShadeTone;
  if (h < 20 || h > 345) tone = "cool";
  else if (h <= 45) tone = "warm";
  else tone = "neutral";

  let depth: ShadeDepth;
  if (l >= 65) depth = "light";
  else if (l >= 40) depth = "medium";
  else depth = "deep";

  const label = `${tone}, ${depth}`;
  return {
    hex: hex.startsWith("#") ? hex : `#${hex}`,
    tone,
    depth,
    label,
    pitchLine: `Matched to my tone: ${label}`,
  };
}
