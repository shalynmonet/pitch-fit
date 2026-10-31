"use client";

import { useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import ImageDropzone from "@/components/ImageDropzone";
import BrandResultCard from "@/components/BrandResultCard";
import LoadingNote from "@/components/LoadingNote";
import { GARMENT_CATEGORIES, type GarmentCategory } from "@/lib/types";
import type { ShadeMatch } from "@/lib/shade";
import { FOCUS_METRICS, type SkinStrength } from "@/lib/skinStrengths";

const MAX_CREATORS = 3;

const SKIN_AI_DISCLAIMER = "Cosmetic skin analysis, not medical advice. Results vary with lighting.";

interface CreatorResult {
  label: string;
  status: "loading" | "error" | "done";
  resultImageSrc?: string;
  error?: string;
  skinStrengths?: SkinStrength[] | null;
  skinStrengthsNote?: string | null;
  skinScores?: { type: string; uiScore: number }[] | null;
  shadeMatch?: ShadeMatch | null;
  shadeNote?: string | null;
}

export default function BrandPage() {
  const [product, setProduct] = useState<File | null>(null);
  const [creators, setCreators] = useState<(File | null)[]>([null, null, null]);
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>("upper_body");
  const [compareSkinProfiles, setCompareSkinProfiles] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [focusMetric, setFocusMetric] = useState(FOCUS_METRICS[0].type);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CreatorResult[] | null>(null);

  const activeCreators = creators.filter((c): c is File => c !== null);
  const canGenerate = Boolean(
    product && activeCreators.length > 0 && (!compareSkinProfiles || consentChecked)
  );

  const strongestLabel = useMemo(() => {
    if (!compareSkinProfiles || !results) return null;
    let best: { label: string; score: number } | null = null;
    for (const r of results) {
      const score = r.skinScores?.find((s) => s.type === focusMetric)?.uiScore;
      if (typeof score === "number" && (!best || score > best.score)) {
        best = { label: r.label, score };
      }
    }
    return best?.label ?? null;
  }, [compareSkinProfiles, results, focusMetric]);

  function setCreatorAt(index: number, file: File | null) {
    setCreators((prev) => prev.map((c, i) => (i === index ? file : c)));
  }

  async function fetchSkinProfile(creatorFile: File) {
    const skinToneForm = new FormData();
    skinToneForm.set("selfie", creatorFile);
    const skinAnalysisForm = new FormData();
    skinAnalysisForm.set("selfie", creatorFile);

    const [skinToneRes, skinAnalysisRes] = await Promise.all([
      fetch("/api/skin-tone", { method: "POST", body: skinToneForm }),
      fetch("/api/skin-analysis", { method: "POST", body: skinAnalysisForm }),
    ]);

    const profile: Pick<
      CreatorResult,
      "skinStrengths" | "skinStrengthsNote" | "skinScores" | "shadeMatch" | "shadeNote"
    > = {};

    if (skinAnalysisRes.ok) {
      const json = await skinAnalysisRes.json();
      profile.skinStrengths = json.strengths ?? null;
      profile.skinScores = json.scores ?? null;
    } else {
      const json = await skinAnalysisRes.json().catch(() => ({}));
      profile.skinStrengthsNote = friendlySkinApiError(json, "Skin Strengths");
    }

    if (skinToneRes.ok) {
      const json = await skinToneRes.json();
      profile.shadeMatch = json.shadeMatch ?? null;
      if (!json.shadeMatch) profile.shadeNote = "Couldn't detect a shade match for this photo.";
    } else {
      const json = await skinToneRes.json().catch(() => ({}));
      profile.shadeNote = friendlySkinApiError(json, "Shade Match");
    }

    return profile;
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

          const [vtoRes, skinProfile] = await Promise.all([
            fetch("/api/vto", { method: "POST", body: form }),
            compareSkinProfiles ? fetchSkinProfile(creatorFile) : Promise.resolve(null),
          ]);
          const json = await vtoRes.json();
          if (!vtoRes.ok) throw new Error(json.error ?? "Try-on failed");
          return {
            label: `Creator ${i + 1}`,
            status: "done" as const,
            resultImageSrc: json.resultDataUrl,
            ...(skinProfile ?? {}),
          };
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
            {compareSkinProfiles && (
              <label className="flex max-w-xs flex-col gap-2">
                <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                  Focus metric
                </span>
                <select
                  value={focusMetric}
                  onChange={(e) => setFocusMetric(e.target.value)}
                  className="border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                >
                  {FOCUS_METRICS.map((m) => (
                    <option key={m.type} value={m.type}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {results.map((r, i) => (
                <BrandResultCard
                  key={i}
                  {...r}
                  focusMetricLabel={
                    compareSkinProfiles
                      ? FOCUS_METRICS.find((m) => m.type === focusMetric)?.label
                      : undefined
                  }
                  isStrongestForFocus={compareSkinProfiles && strongestLabel === r.label}
                />
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

            <div className="border border-line bg-white p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={compareSkinProfiles}
                  onChange={(e) => {
                    setCompareSkinProfiles(e.target.checked);
                    if (!e.target.checked) setConsentChecked(false);
                  }}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium uppercase tracking-wide text-ink">
                    Compare skin profiles
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    Scan each creator&apos;s photo for Skin Strengths and a Shade Match, and
                    highlight whoever scores strongest on a metric you choose.
                  </span>
                </span>
              </label>

              {compareSkinProfiles && (
                <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                  <p className="text-xs text-ink-soft">
                    For the most accurate scan: face a window or soft light source, and skip
                    filters.
                  </p>
                  <p className="text-xs text-ink-soft">{SKIN_AI_DISCLAIMER}</p>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-accent"
                    />
                    <span className="text-sm text-ink-soft">
                      I confirm each creator has consented to having their photo analyzed for
                      this skin profile comparison.
                    </span>
                  </label>
                </div>
              )}
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

function friendlySkinApiError(json: { error?: string; code?: string }, feature: string): string {
  const code = json.code ?? "";
  const lower = feature.toLowerCase();
  if (code === "timeout") {
    return `${feature} took longer than expected, so we skipped it for this creator.`;
  }
  if (code.startsWith("error_face_angle")) {
    return `Couldn't get a clean ${lower} — try a photo facing the camera directly.`;
  }
  if (code === "error_src_face_too_small") {
    return `Couldn't get a clean ${lower} — try a closer, face-forward photo.`;
  }
  if (code === "CreditInsufficiency") {
    return `We're out of YouCam credits for ${lower} right now.`;
  }
  return `Couldn't get a ${lower} for this photo.`;
}
