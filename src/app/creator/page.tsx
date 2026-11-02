"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import ImageDropzone from "@/components/ImageDropzone";
import LoadingNote from "@/components/LoadingNote";
import PitchBoard from "@/components/PitchBoard";
import {
  NICHES,
  GARMENT_CATEGORIES,
  PRODUCT_TYPES,
  PRODUCT_TYPE_PHOTO,
  PRODUCT_TYPE_PRODUCT_PHOTO_HINT,
  type Niche,
  type GarmentCategory,
  type ProductType,
  type Concept,
} from "@/lib/types";
import type { ShadeMatch } from "@/lib/shade";
import type { SkinStrength } from "@/lib/skinStrengths";

type Status = "idle" | "loading" | "error" | "done";

const SKIN_AI_DISCLAIMER = "Cosmetic skin analysis, not medical advice. Results vary with lighting.";

export default function CreatorPage() {
  const [selfie, setSelfie] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [niche, setNiche] = useState<Niche>("travel");
  const [productType, setProductType] = useState<ProductType>("clothing");
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>("upper_body");
  const [beautyPitch, setBeautyPitch] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [shadeMatch, setShadeMatch] = useState<ShadeMatch | null>(null);
  const [shadeNote, setShadeNote] = useState<string | null>(null);
  const [skinStrengths, setSkinStrengths] = useState<SkinStrength[] | null>(null);
  const [skinStrengthsNote, setSkinStrengthsNote] = useState<string | null>(null);

  const canGenerate = selfie && productImage && productName.trim() && productDescription.trim();

  async function handleGenerate() {
    if (!selfie || !productImage) return;
    setStatus("loading");
    setError(null);
    setShadeMatch(null);
    setShadeNote(null);
    setSkinStrengths(null);
    setSkinStrengthsNote(null);

    try {
      const vtoForm = new FormData();
      vtoForm.set("selfie", selfie);
      vtoForm.set("product", productImage);
      vtoForm.set("productType", productType);
      if (productType === "clothing") {
        vtoForm.set("garmentCategory", garmentCategory);
      }

      const skinToneForm = new FormData();
      skinToneForm.set("selfie", selfie);

      const skinAnalysisForm = new FormData();
      skinAnalysisForm.set("selfie", selfie);

      // Fire VTO and the Skin AI calls together; Skin Analysis is awaited before the
      // concept call so its strengths can be woven into the hooks/pitch email.
      const vtoPromise = fetch("/api/vto", { method: "POST", body: vtoForm });
      const skinTonePromise = beautyPitch
        ? fetch("/api/skin-tone", { method: "POST", body: skinToneForm })
        : null;
      const skinAnalysisPromise = beautyPitch
        ? fetch("/api/skin-analysis", { method: "POST", body: skinAnalysisForm })
        : null;

      let strengths: SkinStrength[] | null = null;
      if (skinAnalysisPromise) {
        const skinAnalysisRes = await skinAnalysisPromise;
        if (skinAnalysisRes.ok) {
          const skinAnalysisJson = await skinAnalysisRes.json();
          strengths = skinAnalysisJson.strengths ?? null;
          setSkinStrengths(strengths);
        } else {
          const skinAnalysisJson = await skinAnalysisRes.json().catch(() => ({}));
          setSkinStrengthsNote(friendlySkinAnalysisError(skinAnalysisJson));
        }
      }

      const conceptRes = await fetch("/api/concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, productDescription, niche, skinStrengths: strengths }),
      });

      const [vtoRes, skinToneRes] = await Promise.all([vtoPromise, skinTonePromise ?? Promise.resolve(null)]);

      const vtoJson = await vtoRes.json();
      const conceptJson = await conceptRes.json();

      if (!vtoRes.ok) {
        throw new Error(friendlyVtoError(vtoJson, productType));
      }
      if (!conceptRes.ok) {
        throw new Error(conceptJson.error ?? "Couldn't write the pitch concept. Please try again.");
      }

      setResultImage(vtoJson.resultDataUrl);
      setConcept(conceptJson);

      if (beautyPitch && skinToneRes) {
        if (skinToneRes.ok) {
          const skinToneJson = await skinToneRes.json();
          setShadeMatch(skinToneJson.shadeMatch ?? null);
          if (!skinToneJson.shadeMatch) {
            setShadeNote("Couldn't detect a shade match for this photo.");
          }
        } else {
          const skinToneJson = await skinToneRes.json().catch(() => ({}));
          setShadeNote(friendlySkinToneError(skinToneJson));
        }
      }

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setResultImage(null);
    setConcept(null);
    setShadeMatch(null);
    setShadeNote(null);
    setSkinStrengths(null);
    setSkinStrengthsNote(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-serif text-3xl sm:text-4xl">Creator concept mock</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Upload a selfie and a product photo. We&apos;ll generate a try-on mock and a pitch
          concept you can send to the brand, before you ever shoot real content.
        </p>

        {status === "loading" && (
          <LoadingNote
            label="Building your concept mock…"
            detail="We're rendering the product on your photo and writing the pitch at the same time."
          />
        )}

        {status === "done" && resultImage && concept && (
          <div className="mt-10 flex flex-col gap-6">
            <PitchBoard
              resultImageSrc={resultImage}
              concept={concept}
              creatorLabel={productName}
              shadeMatch={shadeMatch}
              shadeNote={shadeNote}
              skinStrengths={skinStrengths}
              skinStrengthsNote={skinStrengthsNote}
            />
            <button
              type="button"
              onClick={reset}
              className="self-start text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              ← Start a new mock
            </button>
          </div>
        )}

        {(status === "idle" || status === "error") && (
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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ImageDropzone
                label={`Your ${PRODUCT_TYPE_PHOTO[productType].noun}`}
                hint={PRODUCT_TYPE_PHOTO[productType].hint}
                file={selfie}
                onChange={setSelfie}
              />
              <ImageDropzone
                label="Product photo"
                hint={PRODUCT_TYPE_PRODUCT_PHOTO_HINT[productType]}
                file={productImage}
                onChange={setProductImage}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                  Product name
                </span>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="TrailLight Packable Daypack"
                  className="border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                />
              </label>

              {productType === "clothing" && (
                <label className="flex flex-col gap-2">
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
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Product description
              </span>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={3}
                placeholder="A 20L water-resistant daypack that folds into its own pocket…"
                className="border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Your niche
              </span>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => setNiche(n.value)}
                    className={`border px-4 py-2 text-sm transition-colors ${
                      niche === n.value
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-ink-soft hover:border-ink hover:text-ink"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </label>

            <div className="border border-line bg-white p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={beautyPitch}
                  onChange={(e) => setBeautyPitch(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium uppercase tracking-wide text-ink">
                    Beauty pitch
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    Also scan your selfie for your top Skin Strengths and a Shade Match line,
                    woven into your pitch.
                  </span>
                </span>
              </label>
              {beautyPitch && (
                <div className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
                  <p>
                    For the most accurate scan: face a window or soft light source, and skip
                    filters.
                  </p>
                  <p className="mt-1">{SKIN_AI_DISCLAIMER}</p>
                </div>
              )}
            </div>

            {error && (
              <p className="border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="self-start bg-ink px-8 py-3 text-sm font-medium uppercase tracking-wide text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              Generate concept mock
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
  return json.error ?? "Couldn't generate the try-on. Please try again.";
}

function friendlySkinApiError(json: { error?: string; code?: string }, feature: string): string {
  const code = json.code ?? "";
  const lower = feature.toLowerCase();
  if (code === "timeout") {
    return `${feature} took longer than expected, so we skipped it this time.`;
  }
  if (code.startsWith("error_face_angle")) {
    return `Couldn't get a clean ${lower}. Try a photo facing the camera directly.`;
  }
  if (code === "error_src_face_too_small") {
    return `Couldn't get a clean ${lower}. Try a closer, face-forward photo.`;
  }
  if (code === "CreditInsufficiency") {
    return `We're out of YouCam credits for ${lower} right now.`;
  }
  return `Couldn't get a ${lower} for this photo, but your concept mock is ready.`;
}

function friendlySkinToneError(json: { error?: string; code?: string }): string {
  return friendlySkinApiError(json, "Shade Match");
}

function friendlySkinAnalysisError(json: { error?: string; code?: string }): string {
  return friendlySkinApiError(json, "Skin Strengths");
}
