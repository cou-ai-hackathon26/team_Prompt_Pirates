# ডেঙ্গুসাথী (DengueSathi)

AI-powered Bangla voice assistant for home monitoring of dengue patients. Team Prompt_Pirates, NSTU.

**Live:** https://dengusathi.vercel.app · **Demo patient:** https://dengusathi.vercel.app/p/demo-rahim · **Manual test list:** `docs/TEST_SCENARIOS.md`

## Assigned challenges: how they are solved

**Direction: a single free-form daily voice update.**

### Challenge 1: the caregiver speaks the whole day's symptoms in one free-form voice message

| What | How | Code |
|---|---|---|
| One message, up to 2 minutes | Recorder compresses to 16 kHz 32 kbps MP3 (~480 KB for 2 min; Gemini and Groq both accept it), countdown in the last 15 s | `src/lib/audio/toMp3.ts`, `src/app/_components/use-recorder.ts` |
| Understands a whole day told out of order, in dialect | Prompt rules: counts ADD UP across the day; a danger sign at ANY time today stays true even if "এখন ভালো আছে"; highest temperature; fever that dropped = critical phase, not recovery; negatives ("নেই", "হয়নি") recorded | `src/lib/ai/prompts.ts` |
| Family sees what the AI understood | Transcript + **day timeline** (সকাল / দুপুর / বিকেল / এখন) + editable symptom chips before anything is saved | `src/app/p/[id]/checkin/checkin-flow.tsx` |
| Several messages on the same day | Merged keeping the WORST of each symptom; a later "fine" message cannot erase an earlier danger sign | `src/lib/risk/merge-day.ts` |
| AI misses a word | Keyword safety net highlights danger words the model left empty (incl. speech-recognition misspellings); never sets values itself | `src/lib/ai/safety-net.ts` |
| No microphone / AI down | Typed text or tap form; the WHO rule engine decides without AI | `checkin-flow.tsx`, `src/lib/risk/who-rules.ts` |

### Challenge 2: escalate safely when voice, CBC photo and symptoms contradict each other or come from the wrong patient

| What | How | Code |
|---|---|---|
| Wrong patient: CBC report | Printed name / age / sex read from the report and compared with the profile (Bangla ↔ English names: "রহিম" = "Rahim Uddin") | `src/lib/risk/consistency.ts` (`identityConflicts`), `src/server/api/routers/cbc.ts` |
| Wrong patient: voice | Person described (e.g. "আমার আব্বা, বয়স ৬৫" for a 9-year-old), or two sick people in one message | `voiceConflicts`, `src/server/api/routers/checkin.ts` |
| What happens then | Data is **held, nothing saved**; the family is asked **"এটা কি রহিমের?"**. "No, someone else" → not saved for this patient, but if the data is dangerous: **"take THAT person to hospital now"** + 16263 | `src/app/_components/identity-check.tsx` |
| Contradictions | "Doing well" vs platelets < 50k; severe signs vs a normal CBC; an implausible overnight platelet recovery; report dated in the future / before the fever / older than 3 days; fever day said ≠ record | `reportConflicts`, `symptomsVsLab` |
| Safety policy | (1) never LOWER risk on doubtful data (a suspicious good result is ignored for the status); (2) contradictory data itself raises the status to at least YELLOW (see a doctor); (3) dangerous changes are never dismissed as errors; (4) the WHO rules decide the minimum, the AI can only raise | `src/server/services/assess.ts`, `src/lib/risk/score.ts` |
| Doctor sees it | "Data conflicts" section on the one-page handoff card, with what the family answered | `src/app/p/[id]/handoff/page.tsx`, `DataConflict` table |

Tests: `pnpm test` (116 Vitest tests, incl. `consistency.test.ts`, `merge-day.test.ts`). Try it: `docs/TEST_SCENARIOS.md` sections B, E, F.

- **Current status and next steps: `docs/PROJECT_STATUS.md`**
- Proposal: `docs/proposal/`
- Implementation plan and known barriers: `docs/IMPLEMENTATION_PLAN.md`
- Clinical rule review sheet for a doctor: `docs/DOCTOR_REVIEW.md`
- Pitch notes (impact model, distribution, slide outline, judge Q&A): `docs/PITCH_NOTES.md`
- **Demo script (read before presenting): `docs/DEMO_SCRIPT.md`**
- AI validation results: `docs/VALIDATION_REPORT.md`

## What it does

| Screen | Path |
|---|---|
| Landing | `/` |
| New patient (no login): area picker for all of Bangladesh (GPS / Bangla-English search) | `/new` |
| Patient home: status, fever-day timeline, today's checklist, daily fluid tracker, platelet/HCT trend, history | `/p/[id]` |
| Calendar reminders (twice daily through fever day 7), add to phone calendar | `/p/[id]/reminders.ics` |
| Daily check-in: Bangla voice, typed text, or tap form, then confirm | `/p/[id]/checkin` |
| CBC report: camera photo, gallery image or PDF → AI-read values → confirm | `/p/[id]/cbc` |
| Nearest hospitals map, directions, 999 | `/p/[id]/hospitals` |
| One-page clinical handoff for the emergency doctor (English, QR, printable) | `/p/[id]/handoff` |
| Hospital / upazila dashboard with spike detection (staff Google login) | `/dashboard` |
| Auto-playing "how it works" walkthrough | `/how-it-works` |
| Demo patient | `/p/demo-rahim` |

## Stack

T3 (pnpm, Next.js 15 App Router, tRPC 11, Prisma 6, Tailwind 4, Auth.js Google login: optional for families, required for the staff dashboard) · Gemini (voice, vision, text, TTS) with hedged Groq fallback · Neon Postgres · Leaflet + OpenStreetMap · Recharts.

## Setup

```bash
pnpm install
cp .env.example .env        # fill GEMINI_API_KEY (+ GROQ_API_KEY recommended) and the database URLs
pnpm db:push                # create tables
pnpm db:seed                # synthetic dashboard data + demo patient
pnpm dev                    # http://localhost:3000
```

Database: Neon (both URLs; `DATABASE_URL` pooled, `DIRECT_URL` direct), Supabase (pooler 6543 + `?pgbouncer=true` / direct 5432), or local Docker.

Phone testing needs HTTPS for mic and camera: deploy to Vercel or run `cloudflared tunnel --url http://localhost:3000`.

## Scripts

| | |
|---|---|
| `pnpm dev` / `pnpm build` | dev server / production build |
| `pnpm test` | Vitest: WHO rules, CBC unit parsing, spike detection (54 tests) |
| `pnpm typecheck` / `pnpm lint` | checks |
| `pnpm db:seed` | ~280 synthetic patients over 21 days + Sonapur spike + demo patient |
| `pnpm demo:reset` | re-create only the demo patient (run right before presenting) |
| `pnpm samples:cbc` | regenerate the synthetic CBC report images/PDFs in `public/samples/cbc/` |
| `node scripts/warm-demo.mjs [url]` | pre-cache the demo sentences and sample reports (instant AI answers on stage) |
| `node scripts/validate-ai.mjs` | end-to-end AI validation against the running app → `docs/VALIDATION_REPORT.md` |
| `node scripts/data/fetch-hospitals.mjs` | refresh hospital list from OpenStreetMap |
| `node scripts/data/fetch-osm-admin.mjs` | refresh OSM district / upazila centres (cache in `scripts/data/cache/`) |
| `node scripts/data/import-bd-locations.mjs <rokto_backend_docker path>` | rebuild `src/data/bd-locations.json` (all divisions / districts / upazilas) |
| `node scripts/data/make-alert-audio.mjs` | regenerate the spoken Bangla alerts (Gemini TTS) |

## Code map

```
src/lib/risk/thresholds.ts      all clinical thresholds (cite + have a doctor review these)
src/lib/risk/who-rules.ts       WHO warning-sign rule engine (pure, tested)
src/lib/risk/score.ts           rules + AI; AI can only raise the status
src/lib/risk/cbc-normalize.ts   CBC unit parsing + sanity ranges
src/lib/anomaly.ts              area spike detection (z-score + 1.5x ratio)
src/lib/ai/                     Gemini / Groq clients, prompts, schemas, cache, hedged fallback
src/lib/audio/toWav.ts          browser: recording -> 16 kHz mono WAV
src/lib/image/compress.ts       browser: photo -> ≤1600 px JPEG
src/server/api/routers/         patient, checkin, cbc, hospital, dashboard
src/server/services/assess.ts   re-run risk for a patient and store it
src/data/                       hospitals (OSM + hand-entered, check "approx" ones)
prisma/seed.ts                  synthetic data + demo patient
public/samples/cbc/             synthetic CBC reports (marked SAMPLE)
public/audio/                   spoken status alerts
```

## Free-tier notes (learned while building)

- `gemini-2.5-flash` is refused for new keys; `gemini-3.8-flash` and `3.5-flash` are often overloaded (503). `gemini-3.5-flash-lite` is the fastest reliable primary. Model IDs live in `.env`.
- Gemini latency is uneven (1 s to 90 s for the same image), so a request starts Groq in parallel after 12 s and takes the first answer.
- Gemini TTS free tier: 10 requests per day.
- AI answers are cached in the `AiCache` table by input: repeated demo inputs are instant and cost no quota.
- Neon free databases sleep when idle; the first request after a pause can fail once. Open the app before presenting.

## Safety

Not a diagnostic tool. WHO rules always take priority over the AI; users confirm every AI-extracted value; prototype uses synthetic data only.
