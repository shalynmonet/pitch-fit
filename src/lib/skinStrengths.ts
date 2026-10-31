// Turns raw Skin Analysis metric scores into creator-facing "strengths" —
// only ever the top N, never a low score or flaw label.

import type { SkinMetricScore } from "./youcam";

// Higher ui_score always means healthier/better for every metric YCE returns here,
// so a friendly label can read as an unambiguous positive regardless of metric.
const METRIC_LABELS: Record<string, string> = {
  moisture: "Hydration",
  texture: "Texture",
  radiance: "Radiance",
  redness: "Even Tone",
  oiliness: "Balance",
  firmness: "Firmness",
  wrinkle: "Smoothness",
  dark_circle_v2: "Brightness",
};

export const FOCUS_METRICS: { type: string; label: string }[] = Object.entries(METRIC_LABELS).map(
  ([type, label]) => ({ type, label })
);

export interface SkinStrength {
  type: string;
  label: string;
  score: number;
}

export function topSkinStrengths(scores: SkinMetricScore[], count = 3): SkinStrength[] {
  return [...scores]
    .sort((a, b) => b.uiScore - a.uiScore || b.rawScore - a.rawScore)
    .slice(0, count)
    .map((s) => ({
      type: s.type,
      label: METRIC_LABELS[s.type] ?? prettify(s.type),
      score: s.uiScore,
    }));
}

function prettify(type: string): string {
  return type
    .replace(/_v\d+$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
