"use client";

import { useEffect, useRef, useState } from "react";
import { drawWatermarkedImage, canvasToPngDownload, type FooterLine } from "@/lib/watermark";
import type { ShadeMatch } from "@/lib/shade";
import type { SkinStrength } from "@/lib/skinStrengths";

const SKIN_AI_DISCLAIMER = "Cosmetic skin analysis, not medical advice. Results vary with lighting.";

interface BrandResultCardProps {
  label: string;
  status: "loading" | "error" | "done";
  resultImageSrc?: string;
  error?: string;
  skinStrengths?: SkinStrength[] | null;
  skinStrengthsNote?: string | null;
  shadeMatch?: ShadeMatch | null;
  shadeNote?: string | null;
  focusMetricLabel?: string | null;
  isStrongestForFocus?: boolean;
}

export default function BrandResultCard({
  label,
  status,
  resultImageSrc,
  error,
  skinStrengths,
  skinStrengthsNote,
  shadeMatch,
  shadeNote,
  focusMetricLabel,
  isStrongestForFocus,
}: BrandResultCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const hasSkinProfile = Boolean(shadeMatch || shadeNote || skinStrengths?.length || skinStrengthsNote);

  useEffect(() => {
    if (status !== "done" || !resultImageSrc || !canvasRef.current) return;

    const footerLines: FooterLine[] = [];
    if (skinStrengths && skinStrengths.length > 0) {
      footerLines.push({ text: `Skin Strengths: ${skinStrengths.map((s) => s.label).join(", ")}` });
    }
    if (shadeMatch) {
      footerLines.push({ text: `Shade Match: ${shadeMatch.label}` });
    }
    if (footerLines.length > 0) {
      footerLines.push({ text: SKIN_AI_DISCLAIMER, muted: true });
    }

    drawWatermarkedImage(canvasRef.current, resultImageSrc, { footerLines })
      .then(() => setReady(true))
      .catch((err) => console.error(err));
  }, [status, resultImageSrc, skinStrengths, shadeMatch]);

  return (
    <div
      className={`flex flex-col gap-3 ${
        isStrongestForFocus ? "rounded-sm border-2 border-accent p-3" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">{label}</span>
        {isStrongestForFocus && focusMetricLabel && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper">
            Strongest {focusMetricLabel}
          </span>
        )}
      </div>
      <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-sm border border-line bg-white">
        {status === "loading" && (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        )}
        {status === "error" && (
          <p className="px-4 text-center text-xs text-accent">{error ?? "Failed to generate"}</p>
        )}
        {status === "done" && <canvas ref={canvasRef} className="h-full w-full object-cover" />}
      </div>
      {status === "done" && (
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && canvasToPngDownload(canvasRef.current, `${label.replace(/\s+/g, "-").toLowerCase()}.png`)}
          className="self-start border border-ink px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          Download
        </button>
      )}

      {status === "done" && hasSkinProfile && (
        <div className="flex flex-col gap-2 border-t border-line pt-3 text-xs">
          {(skinStrengths?.length || skinStrengthsNote) && (
            <div>
              <span className="font-medium uppercase tracking-wide text-ink-soft">Skin Strengths</span>
              {skinStrengths && skinStrengths.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {skinStrengths.map((s) => (
                    <li
                      key={s.type}
                      className="rounded-full border border-accent/40 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-ink-soft">{skinStrengthsNote}</p>
              )}
            </div>
          )}
          {(shadeMatch || shadeNote) && (
            <div>
              <span className="font-medium uppercase tracking-wide text-ink-soft">Shade Match</span>
              {shadeMatch ? (
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="h-4 w-4 flex-none rounded-full border border-line"
                    style={{ backgroundColor: shadeMatch.hex }}
                    aria-hidden
                  />
                  <p className="text-ink-soft">{shadeMatch.label}</p>
                </div>
              ) : (
                <p className="mt-1 text-ink-soft">{shadeNote}</p>
              )}
            </div>
          )}
          <p className="text-ink-soft/70">{SKIN_AI_DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}
