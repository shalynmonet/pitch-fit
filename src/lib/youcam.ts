// Server-only client for the YouCam Enterprise (YCE) Clothes VTO v4 API.
// Never import this from client components — it uses YOUCAM_API_KEY.

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
