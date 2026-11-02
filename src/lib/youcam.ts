// Server-only client for the YouCam Enterprise (YCE) Clothes VTO v4 API.
// Never import this from client components — it uses YOUCAM_API_KEY.

import sharp from "sharp";

const BASE_URL = "https://yce-api-01.makeupar.com";

export type GarmentCategory =
  | "full_body"
  | "lower_body"
  | "upper_body"
  | "shoes"
  | "outer"
  | "auto";

export class YouCamError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "YouCamError";
  }
}

function apiKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) throw new YouCamError("YOUCAM_API_KEY is not set");
  return key;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${apiKey()}`, ...extra };
}

async function parseJsonOrThrow(res: Response, context: string) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    const detail = json ? JSON.stringify(json) : await res.text().catch(() => "");
    throw new YouCamError(`${context} failed (${res.status}): ${detail}`, json?.error_code);
  }
  return json;
}

export async function uploadImage(bytes: Buffer, fileName: string, contentType: string): Promise<string> {
  const initRes = await fetch(`${BASE_URL}/s2s/v2.0/file`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
  });
  const initJson = await parseJsonOrThrow(initRes, "YouCam file init");

  const fileEntry = initJson.data.files[0];
  const fileId: string = fileEntry.file_id;
  const uploadReq = fileEntry.requests[0];

  const putRes = await fetch(uploadReq.url, {
    method: uploadReq.method,
    headers: uploadReq.headers,
    body: new Uint8Array(bytes),
  });
  if (!putRes.ok) {
    throw new YouCamError(`YouCam file upload PUT failed (${putRes.status})`);
  }

  return fileId;
}

export async function createClothTask(
  srcFileId: string,
  refFileId: string,
  garmentCategory: GarmentCategory
): Promise<string> {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/cloth-v4`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      src_file_id: srcFileId,
      ref_file_id: refFileId,
      garment_category: garmentCategory,
      change_shoes: true,
    }),
  });
  const json = await parseJsonOrThrow(res, "YouCam task creation");
  return json.data.task_id;
}

export async function pollClothTask(
  taskId: string,
  { timeoutMs = 45000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/cloth-v4/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await parseJsonOrThrow(res, "YouCam task poll");
    const status = json.data.task_status;

    if (status === "success") return json.data.results.url;
    if (status === "error") {
      throw new YouCamError(json.data.error_message ?? "VTO task failed", json.data.error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new YouCamError("VTO task timed out", "timeout");
}

export type JewelryType = "necklace" | "earring" | "bracelet" | "ring" | "watch";

export async function createJewelryTask(
  type: JewelryType,
  srcFileId: string,
  refFileId: string
): Promise<string> {
  // The live anyOf validator on this endpoint has been unreliable about which branch
  // it reports as missing, so every documented field name is sent at once (same
  // fields the docs' own curl example sends together): the flat ID fields, plus the
  // nested source_info/object_infos shape, all pointing at the same two file IDs.
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/2d-vto/${type}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      src_file_id: srcFileId,
      ref_file_ids: [refFileId],
      source_info: { name: srcFileId },
      object_infos: [{ name: refFileId }],
    }),
  });
  const json = await parseJsonOrThrow(res, `YouCam ${type} task creation`);
  return json.data.task_id;
}

export async function pollJewelryTask(
  type: JewelryType,
  taskId: string,
  { timeoutMs = 45000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/2d-vto/${type}/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await parseJsonOrThrow(res, `YouCam ${type} task poll`);
    const status = json.data.task_status;

    if (status === "success") return json.data.results.url;
    if (status === "error") {
      throw new YouCamError(json.data.error_message ?? `${type} try-on failed`, json.data.error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new YouCamError(`${type} try-on timed out`, "timeout");
}

/** Full pipeline: upload the wearer's photo + product photo, run jewelry/watch try-on, return a data: URL. */
export async function runJewelryVto(
  type: JewelryType,
  wearerPhoto: { bytes: Buffer; fileName: string; contentType: string },
  product: { bytes: Buffer; fileName: string; contentType: string }
): Promise<string> {
  const [srcFileId, refFileId] = await Promise.all([
    uploadImage(wearerPhoto.bytes, wearerPhoto.fileName, wearerPhoto.contentType),
    uploadImage(product.bytes, product.fileName, product.contentType),
  ]);

  const taskId = await createJewelryTask(type, srcFileId, refFileId);
  const resultUrl = await pollJewelryTask(type, taskId);

  const imgRes = await fetch(resultUrl);
  if (!imgRes.ok) throw new YouCamError(`Failed to download ${type} try-on result (${imgRes.status})`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

type Photo = { bytes: Buffer; fileName: string; contentType: string };

// How much to narrow the horizontal crop on each reframe attempt, applied to the
// *original* photo each time (not compounded), centered on the horizontal midpoint.
const REFRAME_WIDTH_FRACTIONS = [0.7, 0.55];

/**
 * Crops a photo to a horizontally-centered strip at `fraction` of its original
 * width, keeping the full height. This is a framing fix only — it narrows the
 * field of view around the (assumed centered) subject so their face takes up more
 * of the width, without guessing where the face actually is. It can't fix a head
 * tilt or rotation, only "too much background on either side."
 */
async function cropCenterWidth(bytes: Buffer, fraction: number): Promise<Buffer> {
  const image = sharp(bytes);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return bytes;
  const width = Math.max(1, Math.round(meta.width * fraction));
  const left = Math.max(0, Math.round((meta.width - width) / 2));
  return image.extract({ left, top: 0, width, height: meta.height }).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Some Skin AI failures (face too small / off-center) are pure framing problems
 * that a tighter, centered horizontal crop can fix using the same photo — unlike a
 * head-angle problem, which cropping can't fix and needs a new photo. On an error
 * whose code is in `reframableCodes`, this retries `attempt` with the photo
 * progressively narrowed (per REFRAME_WIDTH_FRACTIONS), stopping at the first
 * success. Any other error, or running out of attempts, rethrows immediately.
 */
async function withFaceReframe<T>(
  photo: Photo,
  reframableCodes: ReadonlySet<string>,
  attempt: (photo: Photo) => Promise<T>
): Promise<{ result: T; reframed: boolean }> {
  let lastErr: unknown;
  for (let i = 0; i <= REFRAME_WIDTH_FRACTIONS.length; i++) {
    const current: Photo =
      i === 0
        ? photo
        : {
            bytes: await cropCenterWidth(photo.bytes, REFRAME_WIDTH_FRACTIONS[i - 1]),
            fileName: photo.fileName,
            contentType: "image/jpeg",
          };
    try {
      return { result: await attempt(current), reframed: i > 0 };
    } catch (err) {
      lastErr = err;
      const code = err instanceof YouCamError ? err.code : undefined;
      if (!code || !reframableCodes.has(code)) throw err;
    }
  }
  throw lastErr;
}

export interface SkinMetricScore {
  type: string;
  uiScore: number;
  rawScore: number;
}

const SKIN_ANALYSIS_ACTIONS = [
  "moisture",
  "texture",
  "radiance",
  "redness",
  "oiliness",
  "firmness",
  "wrinkle",
  "dark_circle_v2",
];

export async function createSkinAnalysisTask(srcFileId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-analysis`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      src_file_id: srcFileId,
      dst_actions: SKIN_ANALYSIS_ACTIONS,
      format: "json",
    }),
  });
  const json = await parseJsonOrThrow(res, "YouCam skin analysis task creation");
  return json.data.task_id;
}

export async function pollSkinAnalysisTask(
  taskId: string,
  { timeoutMs = 45000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<SkinMetricScore[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-analysis/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await parseJsonOrThrow(res, "YouCam skin analysis poll");
    const status = json.data.task_status;

    if (status === "success") {
      const output: unknown[] = json.data.results?.output ?? [];
      return output
        .filter((entry): entry is { type: string; ui_score: number; raw_score: number } => {
          if (typeof entry !== "object" || entry === null) return false;
          const e = entry as Record<string, unknown>;
          return typeof e.ui_score === "number" && SKIN_ANALYSIS_ACTIONS.includes(e.type as string);
        })
        .map((entry) => ({ type: entry.type, uiScore: entry.ui_score, rawScore: entry.raw_score }));
    }
    if (status === "error") {
      throw new YouCamError(json.data.error_message ?? "Skin analysis failed", json.data.error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new YouCamError("Skin analysis timed out", "timeout");
}

// These two codes mean "the face is there but framed too small / off-center" —
// fixable by narrowing the crop. Angle/rotation codes are deliberately excluded:
// no amount of cropping fixes a tilted head, so those surface as a normal error.
const SKIN_ANALYSIS_REFRAMABLE_CODES = new Set(["error_src_face_too_small", "error_src_face_out_of_bound"]);

export interface SkinAnalysisResult {
  scores: SkinMetricScore[];
  /** True if the photo had to be auto-cropped tighter to pass YouCam's framing check. */
  reframed: boolean;
}

/** Full pipeline: upload a selfie and run AI Skin Analysis, returning per-metric scores. */
export async function runSkinAnalysis(selfie: {
  bytes: Buffer;
  fileName: string;
  contentType: string;
}): Promise<SkinAnalysisResult> {
  const { result: scores, reframed } = await withFaceReframe(
    selfie,
    SKIN_ANALYSIS_REFRAMABLE_CODES,
    async (photo) => {
      const fileId = await uploadImage(photo.bytes, photo.fileName, photo.contentType);
      const taskId = await createSkinAnalysisTask(fileId);
      return pollSkinAnalysisTask(taskId);
    }
  );
  return { scores, reframed };
}

export interface SkinToneResult {
  skinColorHex: string | null;
  eyeColorHex: string | null;
  lipColorHex: string | null;
  eyebrowColorHex: string | null;
  hairColorHex: string | null;
  eyeColorName: string | null;
  hairColorName: string | null;
}

export async function createSkinToneTask(srcFileId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-tone-analysis`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ src_file_id: srcFileId }),
  });
  const json = await parseJsonOrThrow(res, "YouCam skin tone task creation");
  return json.data.task_id;
}

export async function pollSkinToneTask(
  taskId: string,
  { timeoutMs = 45000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<SkinToneResult> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/skin-tone-analysis/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await parseJsonOrThrow(res, "YouCam skin tone poll");
    const status = json.data.task_status;

    if (status === "success") {
      const raw = json.data.results?.color ?? {};
      return {
        skinColorHex: raw.skin_color ?? null,
        eyeColorHex: raw.eye_color ?? null,
        lipColorHex: raw.lip_color ?? null,
        eyebrowColorHex: raw.eyebrow_color ?? null,
        hairColorHex: raw.hair_color ?? null,
        eyeColorName: raw.eye_color_name ?? null,
        hairColorName: raw.hair_color_name ?? null,
      };
    }
    if (status === "error") {
      throw new YouCamError(json.data.error_message ?? "Skin tone analysis failed", json.data.error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new YouCamError("Skin tone analysis timed out", "timeout");
}

// Position codes mean the face is framed too small / off-center — fixable by
// narrowing the crop. Angle/rotation/tilt codes are deliberately excluded: cropping
// can't fix a tilted or turned head, so those surface as a normal error.
const SKIN_TONE_REFRAMABLE_CODES = new Set([
  "error_face_position_too_small",
  "error_face_position_invalid",
  "error_face_position_out_of_boundary",
]);

export interface SkinToneAnalysisResult {
  skinTone: SkinToneResult;
  /** True if the photo had to be auto-cropped tighter to pass YouCam's framing check. */
  reframed: boolean;
}

/** Full pipeline: upload a selfie and run AI Facial Color Tones Analyzer on it. */
export async function runSkinToneAnalysis(selfie: {
  bytes: Buffer;
  fileName: string;
  contentType: string;
}): Promise<SkinToneAnalysisResult> {
  const { result: skinTone, reframed } = await withFaceReframe(
    selfie,
    SKIN_TONE_REFRAMABLE_CODES,
    async (photo) => {
      const fileId = await uploadImage(photo.bytes, photo.fileName, photo.contentType);
      const taskId = await createSkinToneTask(fileId);
      return pollSkinToneTask(taskId);
    }
  );
  return { skinTone, reframed };
}

/** Full pipeline: upload selfie + garment, run try-on, return a data: URL of the result. */
export async function runClothVto(
  selfie: { bytes: Buffer; fileName: string; contentType: string },
  garment: { bytes: Buffer; fileName: string; contentType: string },
  garmentCategory: GarmentCategory
): Promise<string> {
  const [srcFileId, refFileId] = await Promise.all([
    uploadImage(selfie.bytes, selfie.fileName, selfie.contentType),
    uploadImage(garment.bytes, garment.fileName, garment.contentType),
  ]);

  const taskId = await createClothTask(srcFileId, refFileId, garmentCategory);
  const resultUrl = await pollClothTask(taskId);

  const imgRes = await fetch(resultUrl);
  if (!imgRes.ok) throw new YouCamError(`Failed to download VTO result (${imgRes.status})`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}
