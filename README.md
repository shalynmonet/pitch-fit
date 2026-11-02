# PitchFit

**See yourself in the product before you pitch it.**

PitchFit helps UGC (user-generated content) creators land brand deals by generating a
concept mock — a virtual try-on image plus an AI-written pitch (hooks, shot list, and
pitch email) — before the creator ever shoots real content. Brands can do the same in
reverse: upload one product and preview it on several creators to decide who to reach
out to.

Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (Devpost).

**Live demo:** https://pitch-fit-amber.vercel.app

## The problem

- **Creators** waste time and product samples shooting speculative content for pitches
  that may never land. They need a fast, low-cost way to show a brand "here's what this
  would look like on me" before committing to a shoot.
- **Brands** scouting UGC creators have no quick way to preview how a product will
  actually look on a specific creator before sending free product or negotiating a rate.

PitchFit solves both with the same underlying pipeline: a virtual try-on image plus,
for creators, an AI-generated pitch concept — always clearly watermarked as a concept
mock, never mistakable for finished content.

## How it works

1. **Creator mode**: pick a product type (Clothing, Necklace, Earrings, Bracelet, Ring,
   or Watch), upload the matching photo of yourself (selfie, wrist, or hand) and a
   product photo, add the product name/description, and pick your niche (travel,
   wellness, fashion, maker, beauty, other). PitchFit runs the matching virtual try-on
   (see [YouCam APIs used](#youcam-apis-used) below) and writes 3 hooks, a 5-shot shot
   list, and a pitch email — all exported together as a single watermarked PNG "pitch
   board." An optional **Beauty pitch** toggle also scans the selfie for a Skin
   Strengths card and a Shade Match line (see [Skin AI APIs](#skin-ai-apis) below),
   which the concept agent weaves into a hook and the pitch email.
2. **Brand mode**: pick a product type, upload one product photo and up to 3 creator
   photos (matching the product type's photo requirement). PitchFit runs the matching
   try-on for each creator and shows a watermarked grid so you can preview fit across
   creators before reaching out. An optional **Compare skin profiles** toggle scans
   each creator's photo and lets you highlight whoever scores strongest on a metric you
   pick (Hydration, Texture, Radiance, etc.).

## YouCam APIs used

PitchFit routes each try-on to the matching YouCam Enterprise (YCE) API
(`https://yce-api-01.makeupar.com`) based on the selected **Product type**, via
server-only API routes ([src/lib/youcam.ts](src/lib/youcam.ts), dispatched from
[src/app/api/vto/route.ts](src/app/api/vto/route.ts)). Auth is a single
`Authorization: Bearer YOUCAM_API_KEY` header for every endpoint below, no separate
token exchange required.

### AI Clothes / Clothes VTO v4 (`clothing`)

1. **File upload** — `POST /s2s/v2.0/file` registers the selfie and garment images and
   returns a presigned `PUT` URL per file; the raw image bytes are then uploaded
   directly to that URL.
2. **Task creation** — `POST /s2s/v2.0/task/cloth-v4` starts the try-on job with
   `src_file_id` (the selfie), `ref_file_id` (the garment), and `garment_category`
   (`full_body` / `lower_body` / `upper_body` / `shoes` / `outer` / `auto`).
3. **Polling** — `GET /s2s/v2.0/task/cloth-v4/{task_id}` is polled every few seconds
   until `task_status` is `success` (with a `results.url` image, valid ~2 hours) or
   `error`.

### AI Jewelry & Watch Virtual Try-On (`necklace` / `earring` / `bracelet` / `ring` / `watch`)

Each product type listed above is a **separate endpoint**, not one endpoint with a type
parameter (confirmed against `docs.perfectcorp.com`, since Clothes VTO had previously
been used to render a necklace, with predictably bad results):

| Type | Create | Poll | Photo needed | Unit cost |
| --- | --- | --- | --- | --- |
| Necklace | `POST /s2s/v2.0/task/2d-vto/necklace` | `GET .../necklace/{task_id}` | selfie (face + neck visible) | 1 unit |
| Earrings | `POST /s2s/v2.0/task/2d-vto/earring` | `GET .../earring/{task_id}` | selfie (face + ears visible) | 1 unit (2 stacked) |
| Bracelet | `POST /s2s/v2.0/task/2d-vto/bracelet` | `GET .../bracelet/{task_id}` | wrist photo | 1 unit (2 stacked) |
| Ring | `POST /s2s/v2.0/task/2d-vto/ring` | `GET .../ring/{task_id}` | hand photo (back of hand, all 5 fingers) | 1 unit (2 stacked) |
| Watch | `POST /s2s/v2.0/task/2d-vto/watch` | `GET .../watch/{task_id}` | wrist photo | 1 unit |

All five share the same file upload step and request body shape. The request body is an
`anyOf` in YouCam's spec (flat `src_file_id`/`ref_file_ids`, or a nested
`source_info: { name }` / `object_infos: [{ name }]` shape, where `name` is a file ID or
public URL) — but live testing found the endpoint's validator error messages flip
between demanding one shape or the other depending on which one you send, never
confirming either alone is accepted. [src/lib/youcam.ts](src/lib/youcam.ts)'s
`createJewelryTask` sends **all of the documented field names at once** (matching the
docs' own curl example, which also sends both), which is what actually got a live
necklace try-on to succeed end to end.

The result is a flat `{ url }` (same shape as Clothes VTO, valid ~2 hours), downloaded
server-side and returned to the browser as a base64 `data:` URL, same as Clothes VTO.

If a selected product type isn't one of the 6 above, the UI simply doesn't offer it, no
request is ever sent to Clothes VTO for jewelry, which is what caused the original bug
this feature fixes.

## Skin AI APIs

PitchFit also uses two YouCam Enterprise Skin AI endpoints, gated behind the optional
**Beauty pitch** (Creator mode) and **Compare skin profiles** (Brand mode) toggles, via
the same server-only client ([src/lib/youcam.ts](src/lib/youcam.ts)) and the same
upload → create task → poll pattern as the Clothes VTO API above.

### AI Skin Analysis (`skin-analysis`)

- `POST /s2s/v2.0/task/skin-analysis` with `src_file_id` and `dst_actions` — PitchFit
  requests 8 metrics: `moisture`, `texture`, `radiance`, `redness`, `oiliness`,
  `firmness`, `wrinkle`, `dark_circle_v2`. This is an SD-tier, 5–8-concern request:
  **12 units per call**.
- The success response returns a `ui_score` (0–100) per metric, where a **higher score
  always means healthier/better** across every metric — confirmed against a live test
  call. [src/lib/skinStrengths.ts](src/lib/skinStrengths.ts) takes the raw scores,
  sorts them, and keeps only the **top 3** as "strengths," mapped to creator-friendly
  labels (e.g. `redness` → "Even Tone", `wrinkle` → "Smoothness") so nothing reads as a
  flaw callout. The other 5 scores are discarded before the response leaves the server.
- In Creator mode, those 3 labels are passed into the concept agent's prompt so a hook
  and the pitch email reference one naturally (no score numbers, no clinical language).
  In Brand mode, the brand picks one metric from a dropdown and PitchFit highlights
  whichever creator scored highest on it — no ranking language for the others.

### AI Facial Color Tones Analyzer (`skin-tone-analysis`)

- `POST /s2s/v2.0/task/skin-tone-analysis` with `src_file_id` — **20 units per call**
  (flat rate, no SD/HD tiers).
- **Important finding from Step 0 live testing:** this API does **not** return a
  categorical "tone/undertone" field (e.g. "warm, medium") the way earlier planning
  assumed. The real response (`data.results.color`) returns hex colors — `skin_color`,
  `eye_color`, `lip_color`, `eyebrow_color`, `hair_color` — plus `eye_color_name` and
  `hair_color_name` enums only.
- PitchFit derives its own warm/cool + light/medium/deep label from the detected
  `skin_color` hex in [src/lib/shade.ts](src/lib/shade.ts) (HSL hue for warm/cool,
  lightness for depth). This is clearly PitchFit's own estimate, not a raw API field.

### Guardrails

- A small disclaimer — **"Cosmetic skin analysis, not medical advice. Results vary
  with lighting."** — appears wherever Skin AI results are shown (both toggles'
  settings panels, the Creator pitch board, and each Brand result card).
- A lighting tip ("face a window or soft light source, and skip filters") is shown
  before scanning, as soon as either toggle is turned on.
- In Brand mode, a required consent checkbox ("I confirm each creator has consented to
  having their photo analyzed…") disables the Generate button until checked.
- Skin AI results are never persisted server-side — they exist only in React state for
  the session and in the exported PNG. There is no database in this app.
- Both endpoints fail independently of the VTO call and of each other: a face-angle,
  face-too-small, timeout, or credit-insufficiency error from either Skin AI call shows
  a friendly inline message (`friendlySkinApiError` in the Creator/Brand pages) without
  blocking the try-on or the rest of the mock.

## Concept agent

The pitch concept (hooks, shot list, pitch email) is generated by **Gemini**
(`gemini-3.5-flash-lite`) via a server-only API route
([src/lib/concept.ts](src/lib/concept.ts)), using structured JSON output
(`responseSchema`) and [zod](https://zod.dev) validation so malformed responses are
caught before reaching the UI. When Beauty pitch is on, `generateConcept` also accepts
the creator's top Skin Strength labels and instructs the model to weave one in
naturally, with an explicit instruction not to mention scores or any skin concern.

## Safeguards

Mocks are for pitching only — never for posting as final content:

- Every exported image has a diagonal **"CONCEPT MOCK"** watermark and a
  **"CONCEPT MOCK — NOT FOR POSTING"** badge baked directly into the pixels on a
  `<canvas>` before export, so it can't be cropped out by resizing.
- The generated pitch email always includes a line making this explicit:
  _"This is a concept preview. Final content will be shot with the real product."_
- Uploaded photos are only sent to YouCam/Gemini to generate the mock — PitchFit itself
  does not store them server-side, and the YouCam API key never reaches the browser
  (all calls go through Next.js API routes).
- Skin AI results have their own guardrails (disclaimer, lighting tip, Brand-mode
  consent gate, no persistence) — see [Skin AI APIs](#skin-ai-apis).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- YouCam Enterprise Clothes VTO v4 API (server-only)
- YouCam Enterprise Jewelry & Watch Virtual Try-On: necklace, earring, bracelet, ring,
  watch (server-only)
- YouCam Enterprise Skin AI: AI Skin Analysis + AI Facial Color Tones Analyzer (server-only)
- Gemini API (`@google/genai`) for the concept agent
- HTML canvas for watermarking and the pitch-board PNG export
- Deploy target: Vercel

## Setup (Windows / PowerShell)

```powershell
git clone <your-repo-url> pitch-fit
cd pitch-fit
npm install
```

Copy the example env file and fill in your keys:

```powershell
Copy-Item .env.local.example .env.local
```

Edit `.env.local`:

```
YOUCAM_API_KEY=your-youcam-api-key
YOUCAM_API_SECRET=your-youcam-secret        # not currently used by the v4 Clothes API, kept for reference
GEMINI_API_KEY=your-gemini-api-key
```

- Get a YouCam API key from the [YCE API console](https://yce.makeupar.com/api-console/en/api-keys/).
- Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

Run the dev server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional: pre-flight test of the YouCam pipeline

Before (or instead of) using the UI, you can sanity-check the YouCam integration
directly from the command line:

```powershell
node scripts/test-vto.mjs path\to\selfie.jpg path\to\garment.jpg upper_body
```

This uploads both images, creates a try-on task, polls it, and saves the result to
`scripts/test-vto-result.jpg`.

There's an equivalent script for the Skin AI endpoints:

```powershell
node scripts/test-skin.mjs path\to\selfie.jpg
```

This runs one real Skin Analysis call and one real Skin Tone Analysis call against the
selfie and prints the raw JSON responses — useful for confirming a photo passes YouCam's
face-angle/framing checks before wiring up UI around it.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `YOUCAM_API_KEY` | Yes | Bearer token for all YouCam Enterprise API calls |
| `YOUCAM_API_SECRET` | No | Not used by the current v4 Clothes API flow; kept for reference/legacy auth |
| `GEMINI_API_KEY` | Yes | Used by the concept agent (`/api/concept`) |

`.env.local` is gitignored and never committed. The YouCam API key is read only in
server-side code (`src/lib/youcam.ts`) and is never sent to the browser.

## Deploying to Vercel

```powershell
npm install -g vercel
vercel login
vercel
```

Follow the prompts (link or create a project, accept the default build settings — no
changes needed for a standard Next.js app). Then set the same environment variables in
the Vercel dashboard (**Project → Settings → Environment Variables**):
`YOUCAM_API_KEY`, `GEMINI_API_KEY` (and `YOUCAM_API_SECRET` if you want it available).

Redeploy to production:

```powershell
vercel --prod
```

**Note:** the VTO pipeline can take up to ~30 seconds (upload + task + poll). The
`/api/vto` route sets `export const maxDuration = 60`, which requires a Vercel plan that
allows function durations beyond the Hobby plan's 10-second default (Vercel's Fluid
Compute / Pro plan, or adjust `maxDuration` down and rely on faster average completion
times).

## Hackathon rules compliance

- No third-party trademarks appear in the repo's sample/fixture images (none are
  committed — `scripts/fixtures/` is gitignored for the same reason: it holds personal
  test photos, not shareable assets).
- All source, components, API routes, and setup instructions are included in this repo.

## Screenshot checklist

- [ ] Landing page (full view, showing the headline + safeguards row)
- [ ] Creator flow: empty state with both upload dropzones visible
- [ ] Creator flow: Product type selector, showing all 6 options and the photo hint
      changing when a jewelry/watch type is picked
- [ ] Creator flow: finished pitch board for a jewelry product type (e.g. Necklace)
- [ ] Creator flow: loading state ("Building your concept mock…")
- [ ] Creator flow: finished pitch board — watermarked try-on image + hooks + shot list
      + pitch email, all visible
- [ ] Close-up of the watermark (diagonal text + orange "NOT FOR POSTING" badge)
- [ ] Creator flow: Beauty pitch toggle on, showing the lighting tip + disclaimer before
      generating
- [ ] Creator flow: finished pitch board with the Beauty pitch section — Skin Strengths
      chips + Shade Match swatch, both baked into the exported PNG
- [ ] Brand mode: 3-creator grid with results
- [ ] Brand mode: Compare skin profiles on, with the consent checkbox unchecked (showing
      Generate disabled) and then checked
- [ ] Brand mode: a creator card with the "Strongest <metric>" badge after picking a
      focus metric
- [ ] Mobile view of the landing page and the Creator flow (narrow viewport)
- [ ] An error state (e.g. a friendly message after an unclear photo, or a Skin AI
      face-angle error)

## Demo video outline (1–3 minutes)

1. **(0:00–0:15) Hook** — state the problem: creators shoot speculative content for
   pitches that never land; show the landing page and the one-line pitch.
2. **(0:15–0:45) Creator flow** — upload a selfie + product photo on camera, pick a
   niche, hit Generate. Cut to the result once ready (don't make viewers wait the full
   20–30s): watermarked try-on image, hooks, shot list, pitch email.
3. **(0:45–1:00) Safeguards** — point at the watermark and the "concept preview" line in
   the email; explain this is explicitly for pitching, not posting.
4. **(1:00–1:20) Beauty pitch** — flip the toggle, show the lighting tip, and the
   finished Skin Strengths + Shade Match card — point out the hook that references it.
5. **(1:20–1:45) Brand mode** — upload one product + 2–3 creator photos, turn on Compare
   skin profiles, check consent, pick a focus metric, and show the "Strongest" badge.
6. **(1:45–2:00) Tech note** — one sentence on the real YouCam Clothes VTO v4 + Skin AI
   API calls (not mockups) and the Gemini concept agent.
7. **(2:00–2:10) Close** — restate the one-liner and who it's for.

Keep actual API wait time out of the final cut (jump-cut across the loading state, or
speed it up) so the video stays brisk.
