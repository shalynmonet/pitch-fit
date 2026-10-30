"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import ImageDropzone from "@/components/ImageDropzone";
import BrandResultCard from "@/components/BrandResultCard";
import LoadingNote from "@/components/LoadingNote";
import { GARMENT_CATEGORIES, type GarmentCategory } from "@/lib/types";

const MAX_CREATORS = 3;

interface CreatorResult {
  label: string;
  status: "loading" | "error" | "done";
  resultImageSrc?: string;
  error?: string;
}

export default function BrandPage() {
  const [product, setProduct] = useState<File | null>(null);
  const [creators, setCreators] = useState<(File | null)[]>([null, null, null]);
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>("upper_body");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CreatorResult[] | null>(null);

  const activeCreators = creators.filter((c): c is File => c !== null);
  const canGenerate = product && activeCreators.length > 0;

  function setCreatorAt(index: number, file: File | null) {
    setCreators((prev) => prev.map((c, i) => (i === index ? file : c)));
  }

  async function handleGenerate() {
    if (!product) return;
    const chosen = activeCreators;
    setRunning(true);
    setResults(chosen.map((_, i) => ({ label: `Creator ${i + 1}`, status: "loading" })));

    const settled = await Promise.all(
      chosen.map(async (creatorFile, i) => {
        try {
          const form = new FormData();
          form.set("selfie", creatorFile);
          form.set("garment", product);
          form.set("garmentCategory", garmentCategory);
          const res = await fetch("/api/vto", { method: "POST", body: form });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Try-on failed");
          return { label: `Creator ${i + 1}`, status: "done" as const, resultImageSrc: json.resultDataUrl };
        } catch (err) {
          return {
            label: `Creator ${i + 1}`,
            status: "error" as const,
            error: err instanceof Error ? err.message : "Try-on failed",
          };
        }
      })
    );

    setResults(settled);
    setRunning(false);
  }

  function reset() {
    setResults(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-serif text-3xl sm:text-4xl">Brand preview</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Upload one product and up to three creator photos to preview how each creator looks
          wearing it — before you reach out.
        </p>

        {results && !running && (
          <div className="mt-10 flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {results.map((r, i) => (
                <BrandResultCard key={i} {...r} />
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              className="self-start text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              ← Start a new preview
            </button>
          </div>
        )}

        {running && results && (
          <div className="mt-10">
            <LoadingNote label="Generating try-ons for each creator…" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {results.map((r, i) => (
                <BrandResultCard key={i} {...r} />
              ))}
            </div>
          </div>
        )}

        {!results && (
          <div className="mt-10 flex flex-col gap-8">
            <div className="max-w-xs">
              <ImageDropzone label="Product photo" hint="Front-facing, one item" file={product} onChange={setProduct} />
            </div>

            <label className="flex max-w-xs flex-col gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Garment placement
              </span>
              <select
                value={garmentCategory}
                onChange={(e) => setGarmentCategory(e.target.value as GarmentCategory)}
                className="border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink"
              >
                {GARMENT_CATEGORIES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Creator photos (up to {MAX_CREATORS})
              </span>
              <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {creators.map((c, i) => (
                  <ImageDropzone
                    key={i}
                    label={`Creator ${i + 1}${i === 0 ? "" : " (optional)"}`}
                    file={c}
                    onChange={(f) => setCreatorAt(i, f)}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="self-start bg-ink px-8 py-3 text-sm font-medium uppercase tracking-wide text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              Generate previews
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
