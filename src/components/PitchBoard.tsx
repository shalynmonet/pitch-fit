"use client";

import { useEffect, useRef, useState } from "react";
import { drawWatermarkedImage, canvasToPngDownload } from "@/lib/watermark";
import type { Concept } from "@/lib/types";

interface PitchBoardProps {
  resultImageSrc: string;
  concept: Concept;
  fileNamePrefix?: string;
  creatorLabel?: string;
}

export default function PitchBoard({
  resultImageSrc,
  concept,
  fileNamePrefix = "pitchfit-concept",
  creatorLabel,
}: PitchBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWatermarkedImage(canvas, resultImageSrc)
      .then(() => setReady(true))
      .catch((err) => console.error(err));
  }, [resultImageSrc]);

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
