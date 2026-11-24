# ডেঙ্গুসাথী (DengueSathi)

A Bangla voice assistant that helps families monitor a dengue patient at home and tells them when to go to hospital. Built by team Prompt_Pirates, NSTU.

Live app: https://dengusathi.vercel.app. Demo patient: https://dengusathi.vercel.app/p/demo-rahim. Manual test list: `docs/TEST_SCENARIOS.md`.

## How we solved the assigned challenges

The direction we were given was a single free-form daily voice update.

### Challenge 1: the caregiver speaks the whole day's symptoms in one free-form voice message

| What | How | Code |
|---|---|---|
| One message, up to 2 minutes | The recorder compresses audio to 16 kHz, 32 kbps MP3, about 480 KB for 2 minutes. Gemini and Groq both accept it. A countdown appears in the last 15 s | `src/lib/audio/toMp3.ts`, `src/app/_components/use-recorder.ts` |
| Understands a whole day told out of order, in dialect | The prompt adds counts up across the day. A danger sign from any time today stays true even if the caregiver ends with "এখন ভালো আছে". It keeps the highest temperature, treats a fever that dropped as the critical phase rather than recovery, and records negatives such as "নেই" and "হয়নি" | `src/lib/ai/prompts.ts` |
| Family sees what the AI understood | Before anything is saved, the family sees the transcript, a day timeline (সকাল / দুপুর / বিকেল / এখন) and symptom chips they can edit | `src/app/p/[id]/checkin/checkin-flow.tsx` |
| Several messages on the same day | They are merged, keeping the worst value of each symptom, so a later "fine" message cannot erase an earlier danger sign | `src/lib/risk/merge-day.ts` |
| AI misses a word | A keyword check highlights danger words the model left empty, including common speech-recognition misspellings. It only highlights; it never fills in a value | `src/lib/ai/safety-net.ts` |
| No microphone, or AI is down | The family can type or use the tap form, and the WHO rule engine decides without AI | `checkin-flow.tsx`, `src/lib/risk/who-rules.ts` |

### Challenge 2: escalate safely when voice, CBC photo and symptoms contradict each other or come from the wrong patient

| What | How | Code |
|---|---|---|
| Wrong patient: CBC report | The printed name, age and sex are read from the report and compared with the patient profile. Names match across scripts, so "রহিম" matches "Rahim Uddin" | `src/lib/risk/consistency.ts` (`identityConflicts`), `src/server/api/routers/cbc.ts` |
| Wrong patient: voice | The app checks who is being described (for example "আমার আব্বা, বয়স ৬৫" on a 9-year-old's record) and whether one message covers two sick people | `voiceConflicts`, `src/server/api/routers/checkin.ts` |
| What happens then | Nothing is saved yet. The family is asked "এটা কি রহিমের?". If they answer "no, someone else", the data is not saved for this patient, and if it looks dangerous the app tells them to take that other person to hospital now and shows 999 (National Emergency Service ambulance) plus the 16263 doctor-advice line | `src/app/_components/identity-check.tsx` |
| Contradictions | A "doing well" message against platelets under 50k, severe signs against a normal CBC, a platelet recovery too fast to be real, a report dated in the future, before the fever or more than 3 days ago, and a fever day that differs from the record | `reportConflicts`, `symptomsVsLab` |
| Safety policy | Doubtful data never lowers the risk: a suspiciously good result is ignored for the status. Contradictory data raises the status to at least YELLOW, meaning see a doctor. Dangerous changes are never written off as errors. The WHO rules set the minimum status and the AI can only raise it | `src/server/services/assess.ts`, `src/lib/risk/score.ts` |
| What the doctor sees | A "Data conflicts" section on the one-page handoff card, including what the family answered | `src/app/p/[id]/handoff/page.tsx`, `DataConflict` table |

Run `pnpm test` for the 116 Vitest tests (including `consistency.test.ts` and `merge-day.test.ts`). To try both challenges by hand, follow sections B, E and F of `docs/TEST_SCENARIOS.md`.

## Docs

- Current status and next steps: `docs/PROJECT_STATUS.md`
- Demo script, read before presenting: `docs/DEMO_SCRIPT.md`
- Proposal: `docs/proposal/`
- Implementation plan and known barriers: `docs/IMPLEMENTATION_PLAN.md`
- Clinical rule review sheet for a doctor: `docs/DOCTOR_REVIEW.md`
- Pitch notes (impact model, distribution, slide outline, judge Q&A): `docs/PITCH_NOTES.md`
- AI validation results: `docs/VALIDATION_REPORT.md`

## What it does

| Screen | Path |
|---|---|
| Landing | `/` |
| New patient, no login. The area picker covers all of Bangladesh (GPS or Bangla/English search) | `/new` |
| Patient home: status, fever-day timeline, today's checklist, daily fluid tracker, platelet/HCT trend, history | `/p/[id]` |
| Calendar reminders twice a day through fever day 7, added to the phone's calendar | `/p/[id]/reminders.ics` |
| Daily check-in: Bangla voice, typed text, or tap form, then confirm | `/p/[id]/checkin` |
| CBC report from a camera photo, gallery image or PDF. The AI reads the values and the family confirms them | `/p/[id]/cbc` |
| Nearest hospitals map, directions, 999 | `/p/[id]/hospitals` |
| One-page clinical handoff for the emergency doctor (English, QR, printable) | `/p/[id]/handoff` |
| Hospital and upazila dashboard with spike detection, behind staff Google login | `/dashboard` |
| Auto-playing "how it works" walkthrough | `/how-it-works` |
| Demo patient | `/p/demo-rahim` |

## Stack

The app is built on the T3 stack: pnpm, Next.js 15 App Router, tRPC 11, Prisma 6 and Tailwind 4. Auth.js handles Google login, which is optional for families and required for the staff dashboard. Gemini does voice, vision, text and TTS, with Groq as a hedged fallback. Data lives in Neon Postgres, maps use Leaflet and OpenStreetMap, and charts use Recharts.

## Setup

```bash
pnpm install
cp .env.example .env        # fill GEMINI_API_KEY (+ GROQ_API_KEY recommended) and the database URLs
pnpm db:push                # create tables
pnpm db:seed                # synthetic dashboard data + demo patient
pnpm dev                    # http://localhost:3000
```

For the database you can use Neon (`DATABASE_URL` pooled, `DIRECT_URL` direct), Supabase (pooler on 6543 with `?pgbouncer=true`, direct on 5432) or local Docker.

Phones only allow the microphone and camera over HTTPS, so for phone testing either deploy to Vercel or run `cloudflared tunnel --url http://localhost:3000`.

## Scripts

| | |
|---|---|
| `pnpm dev` / `pnpm build` | dev server / production build |
| `pnpm test` | Vitest suite (116 tests): WHO rules, CBC unit parsing, spike detection, conflict checks |
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

## Free-tier notes

Things we learned while building:

- New keys can't use `gemini-2.5-flash`, and `gemini-3.8-flash` and `3.5-flash` are often overloaded (503). `gemini-3.5-flash-lite` has been the fastest reliable primary. Model IDs are set in `.env`.
- Gemini's response time varies a lot, from 1 s to 90 s for the same image. After 12 s we start a Groq request in parallel and use whichever answers first.
- The Gemini TTS free tier allows 10 requests a day.
- AI answers are cached in the `AiCache` table, keyed by input, so repeated demo inputs come back instantly and use no quota.
- Neon's free databases sleep when idle, and the first request after a pause can fail once. Open the app before presenting.

## Safety

DengueSathi is not a diagnostic tool. The WHO rules always take priority over the AI, users confirm every value the AI extracts, and the prototype runs on synthetic data only.
