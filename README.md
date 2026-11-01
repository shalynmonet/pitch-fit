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

1. **Creator mode**: upload a selfie + a product photo, add the product name/description
   and pick your niche (travel, wellness, fashion, maker, beauty, other). PitchFit runs
   a virtual try-on and writes 3 hooks, a 5-shot shot list, and a pitch email — all
   exported together as a single watermarked PNG "pitch board." An optional **Beauty
   pitch** toggle also scans the selfie for a Skin Strengths card and a Shade Match line
   (see [Skin AI APIs](#skin-ai-apis) below), which the concept agent weaves into a hook
   and the pitch email. An optional **Future Self** toggle generates an AI aging
   visualization at 3 ages (now, +10 years, +25 years) plus an extra campaign concept
   built around starting a skincare routine (see [AI Aging Simulation](#ai-aging-simulation-future-self)
   below).
2. **Brand mode**: upload one product photo and up to 3 creator photos. PitchFit runs
   the try-on for each creator and shows a watermarked grid so you can preview fit
   across creators before reaching out. An optional **Compare skin profiles** toggle
   scans each creator's photo and lets you highlight whoever scores strongest on a
   metric you pick (Hydration, Texture, Radiance, etc.).

## YouCam APIs used

PitchFit uses the **YouCam Enterprise (YCE) AI Clothes / Clothes VTO v4** API
(`https://yce-api-01.makeupar.com`) for the virtual try-on, via server-only API routes
([src/lib/youcam.ts](src/lib/youcam.ts)):

1. **File upload** — `POST /s2s/v2.0/file` registers the selfie and garment images and
   returns a presigned `PUT` URL per file; the raw image bytes are then uploaded
   directly to that URL.
2. **Task creation** — `POST /s2s/v2.0/task/cloth-v4` starts the try-on job with
   `src_file_id` (the selfie), `ref_file_id` (the garment), and `garment_category`
   (`full_body` / `lower_body` / `upper_body` / `shoes` / `outer` / `auto`).
3. **Polling** — `GET /s2s/v2.0/task/cloth-v4/{task_id}` is polled every few seconds
   until `task_status` is `success` (with a `results.url` image, valid ~2 hours) or
   `error`.

The server downloads the result and returns it to the browser as a base64 `data:` URL
(not the original signed URL), so it can be drawn onto a `<canvas>` for watermarking
without cross-origin issues, and so the short-lived YouCam URL is never the thing the
frontend depends on.

Auth is a single `Authorization: Bearer YOUCAM_API_KEY` header — no separate token
exchange is required for the v2/v4 Clothes endpoints.

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

## AI Aging Simulation (Future Self)

PitchFit also uses the YouCam Enterprise **AI Aging Simulation** endpoint, gated behind
an optional **Future Self** toggle in Creator mode, via the same server-only client
([src/lib/youcam.ts](src/lib/youcam.ts)) and upload → create task → poll pattern as the
other YouCam features above.

- `POST /s2s/v2.0/task/aging` with `src_file_id` only — there is no settable target-age
  parameter. The API always returns a fixed series of images spanning the person's
  estimated age up through roughly age 70 (16 images, ages 12–70, confirmed against a
  live test call), plus an AI-estimated current age (`data.results.age`) — **2 units per
  call**.
- The selfie is converted to JPG server-side with [sharp](https://sharp.pixelplumb.com/)
  before upload (`src/app/api/future-self/route.ts`), since the endpoint only accepts
  JPG input.
- [src/lib/futureSelf.ts](src/lib/futureSelf.ts) picks 3 ages from the returned series to
  show by default: the one closest to the estimated current age, the closest to +10
  years, and the closest to +25 years (clamped to the series' max age, with a fallback
  so the 3 picks are always distinct). The creator can swap any of the 3 for another age
  from the same series via a dropdown, so no extra API call is needed to re-pick.
- YouCam's result URLs expire in ~2 hours, so the API route fetches **every** returned
  frame server-side immediately and returns them to the browser as base64 `data:` URLs
  the client can keep indefinitely (same reasoning as the Clothes VTO result above).
- When Future Self is on, the concept agent ([src/lib/concept.ts](src/lib/concept.ts))
  also returns a `futureSelf` object: 1 hook, a 3-shot sequence (present, reveal,
  routine), and one pitch-email line for an "aging reveal that motivates starting a
  routine" angle.
- On the exported pitch board, the 3 selected ages are drawn as a labeled strip beneath
  the try-on image, covered by the same diagonal "CONCEPT MOCK" watermark as the rest of
  the board, with a caption and a guardrail note baked in
  ([src/lib/watermark.ts](src/lib/watermark.ts)) — see [Guardrails](#guardrails-1) below.

### Guardrails

- The concept agent is explicitly instructed to use only "AI visualization" /
  "visualize" / "simulate" language for this feature, and never to say the product
  prevents, reverses, stops, or slows aging, and never to say "predict," "will look
  like," or "proven."
- Every exported age strip carries a caption ("AI-generated aging visualization, not a
  forecast.") and a separate disclaimer line ("AI-generated visualization for creative
  concepts only. Not a prediction of how you will age."), both baked into the canvas
  pixels, not just shown in the UI.
- A lighting/angle tip ("use a clear, forward-facing photo") is shown as soon as the
  toggle is turned on, same pattern as the Beauty pitch tip.
- Unit-exhaustion (`CreditInsufficiency`) and face-angle/face-too-small errors are
  caught and shown as a friendly inline message (`friendlyFutureSelfError` in
  `src/app/creator/page.tsx`) without blocking the rest of the mock, same pattern as the
  other Skin AI toggle.
- Future Self results are never persisted server-side — same no-database approach as the
  rest of the app.

## Concept agent

The pitch concept (hooks, shot list, pitch email) is generated by **Gemini**
(`gemini-3.5-flash-lite`) via a server-only API route
([src/lib/concept.ts](src/lib/concept.ts)), using structured JSON output
(`responseSchema`) and [zod](https://zod.dev) validation so malformed responses are
caught before reaching the UI. When Beauty pitch is on, `generateConcept` also accepts
the creator's top Skin Strength labels and instructs the model to weave one in
naturally, with an explicit instruction not to mention scores or any skin concern. When
Future Self is on, `generateConcept` also returns the extra `futureSelf` hook/shots/pitch
line described in [AI Aging Simulation (Future Self)](#ai-aging-simulation-future-self)
above, with explicit wording guardrails against aging/efficacy claims.

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
- Future Self results have their own guardrails (visualization-only wording, baked-in
  caption + disclaimer, lighting tip, no persistence) — see
  [AI Aging Simulation (Future Self)](#ai-aging-simulation-future-self).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- YouCam Enterprise Clothes VTO v4 API (server-only)
- YouCam Enterprise Skin AI: AI Skin Analysis + AI Facial Color Tones Analyzer (server-only)
- YouCam Enterprise AI Aging Simulation (server-only), with [sharp](https://sharp.pixelplumb.com/)
  for server-side JPG conversion
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
- [ ] Creator flow: loading state ("Building your concept mock…")
- [ ] Creator flow: finished pitch board — watermarked try-on image + hooks + shot list
      + pitch email, all visible
- [ ] Close-up of the watermark (diagonal text + orange "NOT FOR POSTING" badge)
- [ ] Creator flow: Beauty pitch toggle on, showing the lighting tip + disclaimer before
      generating
- [ ] Creator flow: finished pitch board with the Beauty pitch section — Skin Strengths
      chips + Shade Match swatch, both baked into the exported PNG
- [ ] Creator flow: Future Self toggle on, showing the lighting tip + disclaimer before
      generating
- [ ] Creator flow: finished pitch board with the Future Self age strip (3 labeled ages)
      baked into the exported PNG, with its caption and guardrail note visible
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
