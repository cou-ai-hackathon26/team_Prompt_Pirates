# DengueSathi: project status and next steps

_Last updated: 2026-11-24 (afternoon) · live at https://dengusathi.vercel.app · manual test list: `docs/TEST_SCENARIOS.md`_

Team Prompt_Pirates (NSTU): Md. Yeasin Arafat, Sohel Mahmud, Aparajita Barua.
Hackathon format: idea proposal (submitted), 3 days of building, 5-hour final demo.

---

## 1. What is built (all working, deployed)

| Area | Status | Where |
|---|---|---|
| New patient (no login, ID kept in the browser, share link) | ✅ | `/new`, `/p/[id]` |
| **All of Bangladesh:** 8 divisions, 64 districts, 569 upazilas / city thanas. Area picker: GPS "find my area" (only the area is stored), forgiving Bangla / English / Banglish search, quick chips, district → upazila list. Centres from OSM / upazila health complexes; 51 marked approximate (excluded from GPS) | ✅ | `area-picker.tsx`, `src/lib/areas.ts`, `area-search.ts`, `scripts/data/import-bd-locations.mjs` |
| **Challenge 1, whole-day voice:** up to 2 min (16 kHz 32 kbps MP3, ~480 KB), last-15 s warning; prompt sums counts over the day, keeps any danger sign from earlier in the day, flags fever that dropped; timeline (সকাল / দুপুর / বিকেল) on the confirm screen; several check-ins on one day are merged keeping the worst of each symptom | ✅ | `toMp3.ts`, `prompts.ts`, `merge-day.ts` |
| **Challenge 2, wrong patient:** CBC printed name / age / sex and the person described in voice (age, sex, name, two sick people) checked against the profile (Bangla↔English names). Data is held and the family asked "এটা কি রহিমের?"; "other" -> not saved, but told to take THAT person to hospital if the data is dangerous | ✅ | `src/lib/risk/consistency.ts`, `identity-check.tsx`, `DataConflict` table |
| **Challenge 2, contradictions:** "well" vs platelets < 50k, severe signs vs normal CBC, implausible overnight platelet recovery, report dated in future / before fever / old, fever day said ≠ record. Policy: never lower risk on doubtful data; contradictions raise to at least YELLOW; shown on the handoff card under "Data conflicts" | ✅ | `consistency.ts`, `assess.ts`, handoff |
| Temperature input accepts Bangla digits and Celsius (35-42 -> °F) | ✅ | `src/lib/temperature.ts` |
| Voice check-in: recorder with live bars and timer → 16 kHz WAV → AI symptom extraction → confirm chips; typed-text and tap-form fallbacks; 3-step indicator | ✅ | `/p/[id]/checkin` |
| CBC report: **camera** or **file/gallery** (images and **PDF**), or sample reports → AI read → unit normalisation and sanity ranges → confirm | ✅ | `/p/[id]/cbc` |
| Risk engine: WHO 2009 warning-sign rules (AI can only *raise* the status), GREEN / YELLOW / RED with reasons tagged "WHO 2009" or "app rule" | ✅ | `src/lib/risk/` |
| Unspecified bleeding ("রক্তপাত আছে") → RED (`bleedingOther`, `ANY_BLEEDING`) | ✅ | schemas, who-rules |
| Keyword safety net: danger words in the transcript that the AI missed get highlighted for the family to check (never auto-set) | ✅ | `src/lib/ai/safety-net.ts` |
| Patient page: status card (pre-recorded Bangla audio alert), fever-day strip, today's checklist, fluid tracker, platelet/HCT trend, history timeline | ✅ | `/p/[id]` |
| Daily fluid tracker (glass / cup / ORS, undo; Holliday-Segar for children) + `LOW_FLUIDS` rule (day 3-7, < 50% by 6 pm) | ✅ | `src/lib/fluids.ts` |
| Calendar reminders (.ics, 9 am and 8 pm through fever day 7) | ✅ | `/p/[id]/reminders.ics` |
| Emergency handoff card for the doctor (English, QR code, lab table with HCT Δ, symptom log, fluids, prints on one A4 page) | ✅ | `/p/[id]/handoff` |
| Nearest hospitals, nationwide: 2,054 OSM hospitals inside Bangladesh (all 64 districts) + 3 hand-entered Noakhali ones; public/emergency first; warning + 16263 / 999 when the nearest is > 25 km (9 remote upazilas, e.g. Teknaf, Sandwip) | ✅ | `/p/[id]/hospitals`, `scripts/data/fetch-hospitals.mjs` |
| Google login (Auth.js v5, JWT cookie). **Staff:** only emails in `STAFF_EMAILS` open `/dashboard` and its API. **Families (optional):** "save with Google" card under a non-RED result (dismiss = 3 days), "আমার রোগী" on home on any phone, patients opened on the phone auto-linked after sign-in (`PatientAccess` table). Patient pages still open by link without login | ✅ | `src/server/auth.ts`, `account.tsx`, `routers/account.ts` |
| Gemini key failover: `GEMINI_BACKUP_API_KEYS` (comma list) tried when a key is out of quota (429, 5-min cooldown per model) or rejected; overload still moves to the next model | ✅ | `src/lib/ai/gemini.ts` |
| Hospital dashboard: upazila ↔ district view, division filter, KPI cards with sparklines, map, 15-day chart, Poisson-aware spike detection per upazila and per district (z ≥ 2, ≥ 3 cases, ≥ 1.5×) | ✅ | `/dashboard` |
| "How it works" auto-playing walkthrough | ✅ | `/how-it-works` |
| Staged AI progress (instead of spinners); AI review time budget of 10 s | ✅ | `ai-progress.tsx`, `assess.ts` |
| AI reliability: Gemini primary → fallback list (one retry on 503, 404 skipped) → hedged Groq after 12 s; responses cached in Postgres | ✅ | `src/lib/ai/` |
| Synthetic data: ~270 patients over 21 days, Sonapur outbreak spike, demo patient `demo-rahim` (fever day 4, days 1-3 GREEN, fluid history) | ✅ | `prisma/seed.ts` |
| 7 synthetic CBC reports (clean / photo / PDF), Bangla TTS alert audio, app icons | ✅ | `public/` |
| Accessible UI (design system `design-system/denguesathi/MASTER.md`): Lucide icons, focus rings, 44 px targets, reduced motion, contrast fixes | ✅ | |
| Tests: 113 Vitest tests (rules, CBC parsing, anomaly, fluids, reminders, safety net, areas / search, day merge, consistency, temperature) | ✅ | `pnpm test` |

### Docs

| File | Purpose |
|---|---|
| `docs/TEST_SCENARIOS.md` | ~50 manual test scenarios with expected results + a 6-minute judge run |
| `docs/DEMO_SCRIPT.md` | stage script, pre-demo checklist, fallbacks, judge answers |
| `docs/PITCH_NOTES.md` | impact model (sourced vs assumed), distribution story, slide outline, Q&A |
| `docs/DOCTOR_REVIEW.md` | printable threshold review sheet for a clinician |
| `docs/VALIDATION_REPORT.md` | AI validation: 25/25 on **synthetic** data (CBC 14/14, text 7/7, TTS voice 4/4) |
| `docs/IMPLEMENTATION_PLAN.md` | original plan and barriers |
| `docs/proposal/` | submitted proposal (PDF/DOCX) |

---

## 2. Configuration (important)

- **Database:** Neon Postgres (pooled `DATABASE_URL`, direct `DIRECT_URL`, both with `connect_timeout=15`). Local and Vercel share the same DB and the same AI cache.
- **Models (`.env` and Vercel env):**
  - `GEMINI_MODEL=gemini-3.5-flash-lite`
  - `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite,gemini-3.8-flash,gemini-3.5-flash` (comma list; `-latest` aliases do **not** work with the SDK)
  - Groq: `openai/gpt-oss-120b` (text), `qwen/qwen3.8-27b` (vision; cannot read PDFs), `whisper-large-v3`
- **Free-tier limits seen:** `gemini-3.5-flash` 20 requests/day; Gemini TTS 10/day; frequent 503 "high demand" on all Gemini models.
- **Vercel:** project `dengusathi` (account s-m-sohel), auto-deploys on push to `main`; `vercel.json` sets the `sin1` region and a 60 s API timeout. Secret env values cannot be read back, only checked by behaviour/logs.
- Local folder is linked to Vercel (`.vercel/`, `.env.local` with an OIDC token, both git-ignored).
- **Commit rule:** short 1-3 line messages, **no Co-Authored-By / AI attribution**.

---

## 3. Remaining steps

### A. Team-only (highest impact for top 3)
1. **Doctor review:** fill `docs/DOCTOR_REVIEW.md` (thresholds A-D incl. A4b bleeding, B8 low fluids, D4 fluid targets). Then update `src/lib/risk/thresholds.ts` and credit the reviewer.
2. **Real evidence:**
   - 5-10 real CBC photos/PDFs (consented, names covered)
   - 10 real voice notes into `scripts/validation/audio/human/<name>.wav` + `<name>.json`
   - then run `node scripts/validate-ai.mjs` and present an honest accuracy table
3. **Interviews:** 2-3 dengue families + 1 doctor; short recorded quotes for the pitch.
4. **Slides** from the outline in `PITCH_NOTES.md`; record a backup demo video.

### B. Optional build items (ask the team first)
1. **WhatsApp voice check-in** (explained, not started). Needs:
   - a Meta developer app with the free test number (5 recipients)
   - 5 env vars
   - a webhook route that reuses the existing extraction and risk code

   About 1 day of work.
2. Show the AI "raising" the status in the demo (a deterministic, cacheable case), or a rules-vs-AI side-by-side.
3. Fill in real `phone` numbers / `dengueCare` flags for demo-area hospitals; verify the 3 approximate Noakhali coordinates.
5. Staff login is built (Google via Auth.js, `/dashboard` + its API). Optional later: let families "save to my account" across phones.
4. Measure cost per patient (log Gemini token usage) for the pitch.

### C. Demo-day checklist (see `DEMO_SCRIPT.md`)
1. `pnpm db:seed` then `pnpm demo:reset` (data is relative to "now").
2. `node scripts/warm-demo.mjs https://dengusathi.vercel.app` (twice; the second run should show "already cached").
3. Open `/`, `/how-it-works`, `/p/demo-rahim`, `/dashboard` once to wake Neon.
4. Mobile hotspot; backup video ready; the printed `public/samples/cbc/demo-day4-shapla.pdf`.

### D. Known issues / risks
- The free Gemini tier is often overloaded, so some requests take 12-16 s and are answered by Groq (lower quality; the safety net helps).
- Groq (backup) Bangla speech recognition is rough on both WAV and MP3; the keyword safety net flags danger words it misspells. Gemini handles the MP3 clips perfectly.
- Groq cannot read PDF reports. If Gemini is down, a PDF falls back to manual entry.
- Validation so far uses synthetic data only. Do not present 100% as real-world accuracy.
- The dashboard runs on synthetic data, and the "48 h expected admissions" figure uses an assumed 30% rate. Label it as such.
- No auth: anyone with a patient link can view it (cuid IDs are unguessable). OTP login is future work.
