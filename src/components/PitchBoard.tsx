"use client";

import { useEffect, useRef, useState } from "react";
import { drawWatermarkedImage, canvasToPngDownload, type FooterLine } from "@/lib/watermark";
import type { Concept } from "@/lib/types";
import type { ShadeMatch } from "@/lib/shade";
import type { SkinStrength } from "@/lib/skinStrengths";

const SKIN_AI_DISCLAIMER = "Cosmetic skin analysis, not medical advice. Results vary with lighting.";

interface PitchBoardProps {
  resultImageSrc: string;
  concept: Concept;
  fileNamePrefix?: string;
  creatorLabel?: string;
  shadeMatch?: ShadeMatch | null;
  shadeNote?: string | null;
  skinStrengths?: SkinStrength[] | null;
  skinStrengthsNote?: string | null;
}

export default function PitchBoard({
  resultImageSrc,
  concept,
  fileNamePrefix = "pitchfit-concept",
  creatorLabel,
  shadeMatch,
  shadeNote,
  skinStrengths,
  skinStrengthsNote,
}: PitchBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  const hasBeautyPitch = Boolean(shadeMatch || shadeNote || skinStrengths?.length || skinStrengthsNote);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    drawWatermarkedImage(canvas, resultImageSrc, { footerLines })
      .then(() => setReady(true))
      .catch((err) => console.error(err));
  }, [resultImageSrc, shadeMatch, skinStrengths]);

  function download() {
    if (!canvasRef.current) return;
    canvasToPngDownload(canvasRef.current, `${fileNamePrefix}.png`);
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(concept.pitchEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-3">
        {creatorLabel && (
          <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
            {creatorLabel}
          </span>
        )}
        <div className="overflow-hidden rounded-sm border border-line bg-white">
          <canvas ref={canvasRef} className="h-auto w-full" />
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!ready}
          className="self-start border border-ink px-5 py-2 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          Download PNG
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {hasBeautyPitch && (
          <section>
            <h3 className="font-serif text-xl">Beauty pitch</h3>

            {(skinStrengths?.length || skinStrengthsNote) && (
              <div className="mt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Skin Strengths
                </span>
                {skinStrengths && skinStrengths.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {skinStrengths.map((s) => (
                      <li
                        key={s.type}
                        className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1 text-xs font-medium text-accent"
                      >
                        {s.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-sm border border-line bg-white p-4 text-sm text-ink-soft">
                    {skinStrengthsNote}
                  </p>
                )}
              </div>
            )}

            {(shadeMatch || shadeNote) && (
              <div className="mt-4">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Shade Match
                </span>
                {shadeMatch ? (
                  <div className="mt-2 flex items-center gap-3 rounded-sm border border-line bg-white p-4">
                    <span
                      className="h-8 w-8 flex-none rounded-full border border-line"
                      style={{ backgroundColor: shadeMatch.hex }}
                      aria-hidden
                    />
                    <p className="text-sm leading-relaxed text-ink-soft">{shadeMatch.pitchLine}</p>
                  </div>
                ) : (
                  <p className="mt-2 rounded-sm border border-line bg-white p-4 text-sm text-ink-soft">
                    {shadeNote}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-ink-soft/70">{SKIN_AI_DISCLAIMER}</p>
          </section>
        )}

        <section>
          <h3 className="font-serif text-xl">Hooks</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {concept.hooks.map((hook, i) => (
              <li key={i} className="border-l-2 border-accent pl-3 text-sm leading-relaxed">
                {hook}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-serif text-xl">Shot list</h3>
          <ol className="mt-3 flex flex-col gap-2">
            {concept.shotList.map((shot, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="font-serif text-ink-soft">{i + 1}.</span>
                <span>{shot}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl">Pitch email</h3>
            <button
              type="button"
              onClick={copyEmail}
              className="text-xs font-medium uppercase tracking-wide text-accent hover:underline"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap rounded-sm border border-line bg-white p-4 text-sm leading-relaxed text-ink-soft">
            {concept.pitchEmail}
          </p>
        </section>
      </div>
    </div>
  );
}
