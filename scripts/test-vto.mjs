// Minimal standalone test of the YouCam Clothes VTO (v4) pipeline.
// Run: node scripts/test-vto.mjs <selfiePath> <garmentPath> [garmentCategory]
//
// Verifies: file upload (2x), task creation, polling, result download.
// Does NOT depend on Next.js — this is a pre-flight check before building the API route.

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const API_KEY = process.env.YOUCAM_API_KEY;
const BASE_URL = "https://yce-api-01.makeupar.com";

if (!API_KEY) {
  console.error("Missing YOUCAM_API_KEY in .env.local");
  process.exit(1);
}

const [, , selfiePath, garmentPath, garmentCategory = "upper_body"] = process.argv;
if (!selfiePath || !garmentPath) {
  console.error("Usage: node scripts/test-vto.mjs <selfiePath> <garmentPath> [garmentCategory]");
  console.error("garmentCategory: full_body | lower_body | upper_body | shoes | outer | auto");
  process.exit(1);
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${API_KEY}`, ...extra };
}

async function uploadFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpg";

  console.log(`Uploading ${fileName} (${bytes.length} bytes)...`);

  const initRes = await fetch(`${BASE_URL}/s2s/v2.0/file`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
  });
  const initJson = await initRes.json();
  if (!initRes.ok) {
    throw new Error(`File init failed (${initRes.status}): ${JSON.stringify(initJson)}`);
  }

  const fileEntry = initJson.data.files[0];
  const { file_id } = fileEntry;
  const uploadReq = fileEntry.requests[0];

  const putRes = await fetch(uploadReq.url, {
    method: uploadReq.method,
    headers: uploadReq.headers,
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`File PUT failed (${putRes.status}): ${await putRes.text()}`);
  }

  console.log(`  -> file_id: ${file_id}`);
  return file_id;
}

async function createTask(srcFileId, refFileId, category) {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/cloth-v4`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      src_file_id: srcFileId,
      ref_file_id: refFileId,
      garment_category: category,
      change_shoes: true,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Task creation failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log(`Task created: ${json.data.task_id}`);
  return json.data.task_id;
}

async function pollTask(taskId, { timeoutMs = 60000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/cloth-v4/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Poll failed (${res.status}): ${JSON.stringify(json)}`);
    }
    const status = json.data.task_status;
    console.log(`  status: ${status} (${Math.round((Date.now() - start) / 1000)}s elapsed)`);
    if (status === "success") return json.data.results.url;
    if (status === "error") {
      throw new Error(`Task error: ${json.data.error} - ${json.data.error_message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
}

async function main() {
  const srcFileId = await uploadFile(selfiePath);
  const refFileId = await uploadFile(garmentPath);
  const taskId = await createTask(srcFileId, refFileId, garmentCategory);

  console.log("Polling for result...");
  const resultUrl = await pollTask(taskId);
  console.log(`Result URL (valid ~2 hours): ${resultUrl}`);

  const imgRes = await fetch(resultUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.join(process.cwd(), "scripts", "test-vto-result.jpg");
  fs.writeFileSync(outPath, buf);
  console.log(`Saved result image to ${outPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
