// Standalone pre-flight test of YouCam Skin Analysis (SD) + Skin Tone Analysis.
// Run: node scripts/test-skin.mjs <selfiePath>
// Prints raw responses so we can confirm the real shape before building UI.

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

const [, , selfiePath] = process.argv;
if (!selfiePath) {
  console.error("Usage: node scripts/test-skin.mjs <selfiePath>");
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

  const initRes = await fetch(`${BASE_URL}/s2s/v2.0/file`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
  });
  const initJson = await initRes.json();
  if (!initRes.ok) throw new Error(`File init failed (${initRes.status}): ${JSON.stringify(initJson)}`);

  const fileEntry = initJson.data.files[0];
  const { file_id } = fileEntry;
  const uploadReq = fileEntry.requests[0];

  const putRes = await fetch(uploadReq.url, { method: uploadReq.method, headers: uploadReq.headers, body: bytes });
  if (!putRes.ok) throw new Error(`File PUT failed (${putRes.status}): ${await putRes.text()}`);

  console.log(`Uploaded ${fileName} -> file_id: ${file_id}`);
  return file_id;
}

async function createTask(feature, body) {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/${feature}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`\n[${feature}] create response:`, JSON.stringify(json, null, 2));
  if (!res.ok) throw new Error(`${feature} task creation failed (${res.status})`);
  return json.data.task_id;
}

async function pollTask(feature, taskId, { timeoutMs = 45000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/s2s/v2.0/task/${feature}/${taskId}`, {
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
    const json = await res.json();
    const status = json.data?.task_status;
    console.log(`[${feature}] poll (${Math.round((Date.now() - start) / 1000)}s): ${status}`);
    if (status === "success" || status === "error") return json;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${feature} task ${taskId} timed out`);
}

async function main() {
  const fileId = await uploadFile(selfiePath);

  // Skin Analysis (SD, a representative subset of metrics, json format for readability)
  const skinAnalysisTaskId = await createTask("skin-analysis", {
    src_file_id: fileId,
    dst_actions: ["moisture", "texture", "radiance", "redness", "oiliness", "firmness", "wrinkle", "dark_circle_v2"],
    format: "json",
  });
  const skinAnalysisResult = await pollTask("skin-analysis", skinAnalysisTaskId);
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "test-skin-analysis-result.json"),
    JSON.stringify(skinAnalysisResult, null, 2)
  );
  console.log("\n[skin-analysis] FULL RESULT:\n", JSON.stringify(skinAnalysisResult, null, 2));

  // Skin Tone Analysis
  const skinToneTaskId = await createTask("skin-tone-analysis", {
    src_file_id: fileId,
  });
  const skinToneResult = await pollTask("skin-tone-analysis", skinToneTaskId);
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "test-skin-tone-result.json"),
    JSON.stringify(skinToneResult, null, 2)
  );
  console.log("\n[skin-tone-analysis] FULL RESULT:\n", JSON.stringify(skinToneResult, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
