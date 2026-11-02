"use client";

import { useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import ImageDropzone from "@/components/ImageDropzone";
import BrandResultCard from "@/components/BrandResultCard";
import LoadingNote from "@/components/LoadingNote";
import {
  GARMENT_CATEGORIES,
  PRODUCT_TYPES,
  PRODUCT_TYPE_PHOTO,
  PRODUCT_TYPE_PRODUCT_PHOTO_HINT,
  FACE_PHOTO_REQUIREMENTS,
  type GarmentCategory,
  type ProductType,
} from "@/lib/types";
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
  beautyPhotoReframed?: boolean;
}

export default function BrandPage() {
  const [product, setProduct] = useState<File | null>(null);
  const [creators, setCreators] = useState<(File | null)[]>([null, null, null]);
  const [creatorFaces, setCreatorFaces] = useState<(File | null)[]>([null, null, null]);
  const [productType, setProductType] = useState<ProductType>("clothing");
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>("upper_body");
  const [compareSkinProfiles, setCompareSkinProfiles] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [focusMetric, setFocusMetric] = useState(FOCUS_METRICS[0].type);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CreatorResult[] | null>(null);

  const activeCreators = creators.filter((c): c is File => c !== null);
  const activeIndexes = creators.flatMap((c, i) => (c !== null ? [i] : []));
  const allActiveHaveFacePhoto = activeIndexes.every((i) => creatorFaces[i] !== null);
  const canGenerate = Boolean(
    product &&
      activeCreators.length > 0 &&
      (!compareSkinProfiles || (consentChecked && allActiveHaveFacePhoto))
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

  function setCreatorFaceAt(index: number, file: File | null) {
    setCreatorFaces((prev) => prev.map((c, i) => (i === index ? file : c)));
  }

  // Skin Strengths / Shade Match need a tight, face-filling headshot (YouCam requires
  // the face to be >60% of the image width and level), which is a different framing
  // than the body photo used for the try-on, so each creator gets a separate face
  // photo rather than reusing their body photo.
  async function fetchSkinProfile(faceFile: File) {
    const skinToneForm = new FormData();
    skinToneForm.set("selfie", faceFile);
    const skinAnalysisForm = new FormData();
    skinAnalysisForm.set("selfie", faceFile);

    const [skinToneRes, skinAnalysisRes] = await Promise.all([
      fetch("/api/skin-tone", { method: "POST", body: skinToneForm }),
      fetch("/api/skin-analysis", { method: "POST", body: skinAnalysisForm }),
    ]);

    const profile: Pick<
      CreatorResult,
      "skinStrengths" | "skinStrengthsNote" | "skinScores" | "shadeMatch" | "shadeNote" | "beautyPhotoReframed"
    > = {};

    if (skinAnalysisRes.ok) {
      const json = await skinAnalysisRes.json();
      profile.skinStrengths = json.strengths ?? null;
      profile.skinScores = json.scores ?? null;
      if (json.reframed) profile.beautyPhotoReframed = true;
    } else {
      const json = await skinAnalysisRes.json().catch(() => ({}));
      profile.skinStrengthsNote = friendlySkinApiError(json, "Skin Strengths");
    }

    if (skinToneRes.ok) {
      const json = await skinToneRes.json();
      profile.shadeMatch = json.shadeMatch ?? null;
      if (!json.shadeMatch) profile.shadeNote = "Couldn't detect a shade match for this photo.";
      if (json.reframed) profile.beautyPhotoReframed = true;
    } else {
      const json = await skinToneRes.json().catch(() => ({}));
      profile.shadeNote = friendlySkinApiError(json, "Shade Match");
    }

    return profile;
  }

  async function handleGenerate() {
    if (!product) return;
    // Map back to original slot indexes so each creator's face photo (indexed the
    // same way as `creators`) pairs with the right body photo, regardless of which
    // slots were left empty.
    const chosen = activeIndexes.map((index) => ({ index, file: creators[index]! }));
    setRunning(true);
    setResults(chosen.map((_, i) => ({ label: `Creator ${i + 1}`, status: "loading" })));

    const settled = await Promise.all(
      chosen.map(async ({ index, file: creatorFile }, i) => {
        try {
          const form = new FormData();
          form.set("selfie", creatorFile);
          form.set("product", product);
          form.set("productType", productType);
          if (productType === "clothing") {
            form.set("garmentCategory", garmentCategory);
          }

          const faceFile = creatorFaces[index];
          const [vtoRes, skinProfile] = await Promise.all([
            fetch("/api/vto", { method: "POST", body: form }),
            compareSkinProfiles && faceFile ? fetchSkinProfile(faceFile) : Promise.resolve(null),
          ]);
          const json = await vtoRes.json();
          if (!vtoRes.ok) throw new Error(friendlyVtoError(json, productType));
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
          wearing it, before you reach out.
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
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Product type
              </span>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TYPES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProductType(p.value)}
                    className={`border px-4 py-2 text-sm transition-colors ${
                      productType === p.value
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-ink-soft hover:border-ink hover:text-ink"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </label>

            <div className="max-w-xs">
              <ImageDropzone
                label="Product photo"
                hint={PRODUCT_TYPE_PRODUCT_PHOTO_HINT[productType]}
                file={product}
                onChange={setProduct}
              />
            </div>

            {productType === "clothing" && (
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
            )}

            <div>
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Creator photos (up to {MAX_CREATORS}), {PRODUCT_TYPE_PHOTO[productType].hint.toLowerCase()}
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
                  {activeIndexes.length > 0 ? (
                    <div>
                      <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                        Face photo per creator
                      </span>
                      <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {activeIndexes.map((index) => (
                          <ImageDropzone
                            key={index}
                            label={`Creator ${index + 1} ${FACE_PHOTO_REQUIREMENTS.noun}`}
                            hint={FACE_PHOTO_REQUIREMENTS.hint}
                            file={creatorFaces[index]}
                            onChange={(f) => setCreatorFaceAt(index, f)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-soft">
                      Add creator photos above, then upload a face photo per creator here.
                    </p>
                  )}
                  <p className="text-xs text-ink-soft">
                    This needs a tighter, face-filling shot than the body photo above — face a
                    window or soft light source, and skip filters.
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

function friendlyVtoError(json: { error?: string; code?: string }, productType: ProductType): string {
  const code = json.code ?? "";
  const photo = PRODUCT_TYPE_PHOTO[productType];
  if (code === "timeout") {
    return "The try-on took longer than expected. Please try again.";
  }
  if (
    code === "error_pose" ||
    code === "error_below_min_image_size" ||
    code === "error_no_face" ||
    code === "PHOTO_DETECTION_FAIL" ||
    code === "INPUT_MAIN_IMAGE_EMPTY"
  ) {
    return `We couldn't detect a clear ${photo.noun}. Try a photo with ${photo.hint.toLowerCase()}.`;
  }
  if (
    code === "error_invalid_ref" ||
    code === "error_apply_region_mismatch" ||
    code === "OBJECT_DETECTION_FAIL"
  ) {
    return "The product photo doesn't look like a clear shot of the item. Try a different image.";
  }
  if (code === "exceed_max_filesize") {
    return "One of the images is too large. Please use a photo under 10MB.";
  }
  if (code === "CreditInsufficiency") {
    return "We're out of YouCam credits for now. Please try again later.";
  }
  return json.error ?? "Try-on failed";
}

function friendlySkinApiError(json: { error?: string; code?: string }, feature: string): string {
  const code = json.code ?? "";
  const lower = feature.toLowerCase();
  if (code === "timeout") {
    return `${feature} took longer than expected, so we skipped it for this creator.`;
  }
  if (code === "error_face_angle_downward") {
    return `Couldn't get a clean ${lower}. Your head is tilted down — lift your chin and face the camera directly, then try again.`;
  }
  if (code === "error_face_angle_upward") {
    return `Couldn't get a clean ${lower}. Your head is tilted back — level your chin and face the camera directly, then try again.`;
  }
  if (code.startsWith("error_face_angle")) {
    return `Couldn't get a clean ${lower}. Face the camera directly, then try again.`;
  }
  if (code === "error_src_face_too_small") {
    return `Couldn't get a clean ${lower}. Your face is too small in the frame — move closer so it fills most of the photo, then try again.`;
  }
  if (code === "CreditInsufficiency") {
    return `We're out of YouCam credits for ${lower} right now.`;
  }
  return `Couldn't get a ${lower} for this photo.`;
}
