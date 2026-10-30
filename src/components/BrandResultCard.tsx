"use client";

import { useEffect, useRef, useState } from "react";
import { drawWatermarkedImage, canvasToPngDownload } from "@/lib/watermark";

interface BrandResultCardProps {
  label: string;
  status: "loading" | "error" | "done";
  resultImageSrc?: string;
  error?: string;
}

export default function BrandResultCard({ label, status, resultImageSrc, error }: BrandResultCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status !== "done" || !resultImageSrc || !canvasRef.current) return;
    drawWatermarkedImage(canvasRef.current, resultImageSrc)
      .then(() => setReady(true))
      .catch((err) => console.error(err));
  }, [status, resultImageSrc]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">{label}</span>
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
    </div>
  );
}
