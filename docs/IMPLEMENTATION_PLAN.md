# DengueSathi: Implementation Plan

Stack: T3 (pnpm, Next.js App Router, Prisma, tRPC, Tailwind, no auth). Everything runs on free tiers.

---

## 1. Architecture

```
Phone browser (PWA, Chrome)
 ├─ Mic → MediaRecorder → WAV (16 kHz mono) ──┐
 ├─ Camera → CBC photo → resize/compress JPEG ─┤  base64 over tRPC (or route handler)
 └─ Leaflet map, trend charts                  │
                                               ▼
Next.js server (Vercel Hobby)
 ├─ tRPC routers: patient, checkin, cbc, risk, dashboard, hospital
 ├─ lib/ai/gemini.ts      → Gemini Flash (audio + vision + JSON output)
 ├─ lib/ai/fallback.ts    → Groq (Whisper STT, Llama vision) if Gemini fails or hits a rate limit
 ├─ lib/risk/who-rules.ts → hard WHO rules (pure TS, unit tested)
 ├─ lib/risk/score.ts     → combines rules + AI trend reasoning (rules always win)
 └─ lib/anomaly.ts        → z-score per area for the dashboard
                                               ▼
Postgres (Supabase free or Neon free) via Prisma
```

**No auth:** create a patient on the first visit, store `patientId` (cuid) in localStorage, and show a share link `/p/<id>` so a second family member can open the same patient. Hospital dashboard at `/dashboard` (open for the demo; add a simple env passcode if wanted).

---

## 2. Free services, and what each one does

| Need | Primary (free) | Fallback (free) | Notes |
|---|---|---|---|
| Bangla speech → structured symptoms | **Gemini Flash** with audio input: one call transcribes and extracts JSON | **Groq Whisper large-v3(-turbo)** for transcript, then a text LLM for extraction; or **Web Speech API** (`lang="bn-BD"`) in Chrome | Gemini handles colloquial Bangla best. Web Speech is free and instant but Chrome-only and gives text only |
| CBC report photo → numbers | **Gemini Flash** vision with a response schema | **Groq Llama 4 Scout** (vision) or **OpenRouter free vision models** | Always show values for user confirmation |
| Bangla explanation of risk | Gemini Flash (text) | Groq Llama / Gemma | Cache by (status, flags) to save calls |
| Text-to-speech (read alert aloud) | Browser `speechSynthesis` with a `bn-BD` voice if installed | Pre-recorded MP3 for the 3 statuses | Many phones lack a Bangla voice; pre-recorded clips are the reliable path |
| Database | Supabase Postgres free (500 MB) | Neon free | Prisma connects to either |
| Hosting | Vercel Hobby | Local + ngrok/cloudflared tunnel for demo | HTTPS is required for mic and camera |
| Map + hospitals | Leaflet + OSM tiles; hospitals from Overpass API, **saved once to a JSON file** | Hand-made JSON of hospitals in demo areas | Don't call Overpass live during the demo |
| Charts | Recharts | | |

Get keys: Gemini at aistudio.google.com (no card), Groq at console.groq.com (no card).

---

## 3. How to implement each AI piece

### 3.1 Voice check-in (the trickiest part)

1. Client records with `MediaRecorder`. Chrome produces `audio/webm;codecs=opus`, Safari produces `audio/mp4`.
2. **Convert to WAV in the browser** before upload: decode with `AudioContext.decodeAudioData`, downsample to 16 kHz mono, write a WAV header (about 40 lines of code, or the `audiobuffer-to-wav` package). WebM is not in Gemini's documented audio formats; WAV, MP3, OGG, FLAC and AAC are. 16 kHz mono WAV is about 32 KB per second, so a 30-second clip is about 1 MB.
3. Cap recordings at 30–45 seconds.
4. Send base64 to `checkin.submitVoice`. Server calls Gemini with the audio inline plus a prompt and a JSON response schema:

```ts
// lib/ai/schemas.ts (zod, reused for tRPC output and Gemini responseSchema)
SymptomExtraction = {
  transcript_bn: string,
  fever: boolean | null, temperature_f: number | null,
  vomiting_count_24h: number | null,
  abdominal_pain: "none" | "mild" | "severe" | null,
  bleeding: { gums, nose, vomit_blood, black_stool, skin_spots: boolean | null },
  urine_reduced: boolean | null,           // e.g. no urine for 6+ hours
  drowsy_or_restless: boolean | null,
  can_drink_fluids: boolean | null,
  fluid_intake_litres: number | null,
  cold_clammy_hands: boolean | null,
  day_of_fever: number | null,
  unclear_fields: string[]                 // ask follow-up questions for these
}
```

5. Show the extracted symptoms as Bangla chips; the caregiver taps to correct any wrong one, then saves.
6. **Tap-form fallback**: the same fields as big yes/no buttons. This is also the demo safety net if the network is slow.

### 3.2 CBC report reader

1. Client: `<input type="file" accept="image/*" capture="environment">`, resize to max 1600 px long side, JPEG quality 0.8 (about 200–400 KB).
2. Server: Gemini vision with schema `{ platelet_per_uL, hematocrit_pct, wbc_per_uL, hemoglobin_g_dl, report_date, lab_name, confidence: "high"|"low", raw_lines[] }`.
3. **Normalise units in code, not in the LLM**: platelets may be written as `150000`, `150 x10^3/uL`, `1.5 lakh`, `150 K`. Keep a sanity range (platelets 1,000–1,000,000; HCT 15–70%); values outside it are rejected and the user types them.
4. User confirms or edits before saving. Store numbers only; don't store the photo (privacy, and less storage).
5. Prepare 5–6 synthetic CBC images in different lab layouts (make them in Word/Canva from real templates with fake data) for testing and the demo.

### 3.3 Risk engine (code first, AI second)

`lib/risk/who-rules.ts`: pure functions, unit tested with Vitest.

- **RED (go to hospital now)** if any WHO 2009 warning sign: severe or persistent abdominal pain, persistent vomiting (3+ times in 24 h), mucosal bleeding, lethargy/restlessness, cold clammy hands, no urine for 6+ hours, can't drink fluids, **or** HCT rise ≥ 20% from baseline with platelets falling, **or** platelets < 50,000.
- **YELLOW (see a doctor today)**: fever day 3–7 with any new symptom, platelets 50,000–100,000 and falling, HCT rising 10–20%, no check-in for 24 h during the critical phase, or high-risk patient (infant, pregnant, elderly, diabetes, kidney disease).
- **GREEN**: everything else.

`lib/risk/score.ts`: the AI receives the full multi-day timeline and may only **raise** the status (e.g. a worrying trend the rules miss) and must give a reason. It can never lower a rule-based RED. Final status = max(rules, AI). Store both and the reasons, so you can show judges "rule fired: X" vs "AI flagged: Y".

Thresholds must be checked against WHO 2009 and the DGHS National Dengue Guideline before the demo; keep them in one config file with a citation comment.

### 3.4 Care coach

Mostly static Bangla content (fluid targets by weight, ORS/coconut water/soup, "no NSAIDs: avoid ibuprofen/aspirin, paracetamol only"). Gemini only personalises the wording for the day's status. Reminders: in-app list + the browser Notification API while the app is open (true push needs a service worker and VAPID keys; treat as stretch).

### 3.5 Nearest hospital

One-time script `scripts/fetch-hospitals.ts` queries Overpass for `amenity=hospital` in Dhaka + Noakhali, saves `data/hospitals.json`, then you hand-mark which ones are dengue-designated. At runtime: browser geolocation → Haversine sort → top 3 on Leaflet with a "call" and "directions" (Google Maps URL) button. Load Leaflet with `next/dynamic` and `ssr: false`.

### 3.6 Area dashboard + anomaly detection

- Each patient has an area (upazila/thana picked from a list, not GPS, for privacy).
- Dashboard: map with circle markers sized by active cases, coloured by RED count; a table of areas; a 7-day chart.
- Anomaly: for each area, today's RED+YELLOW count vs the mean and SD of the previous 14 days; flag when z > 2 and count ≥ 3. Also a simple "expected RED in 48 h" = number of YELLOW patients on fever day 3–5 × a fixed conversion rate (state it's a heuristic).
- `prisma/seed.ts` generates about 300 synthetic patients over 21 days across 10 areas, with a planted spike in one area for the demo.

---

## 4. Prisma schema (draft)

```prisma
model Patient {
  id           String   @id @default(cuid())
  nickname     String
  ageYears     Int
  sex          String?
  weightKg     Float?
  riskFactors  String[] // pregnant, diabetes, kidney, infant, elderly
  area         String
  feverStart   DateTime
  createdAt    DateTime @default(now())
  isSynthetic  Boolean  @default(false)
  checkIns     CheckIn[]
  labs         LabResult[]
  assessments  RiskAssessment[]
}

model CheckIn {
  id         String   @id @default(cuid())
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  source     String   // voice | form
  transcript String?
  symptoms   Json     // validated SymptomExtraction
  @@index([patientId, createdAt])
}

model LabResult {
  id          String   @id @default(cuid())
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  takenAt     DateTime
  plateletUl  Int?
  hctPct      Float?
  wbcUl       Int?
  hbGdl       Float?
  confirmed   Boolean  @default(false)
  @@index([patientId, takenAt])
}

model RiskAssessment {
  id          String   @id @default(cuid())
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  status      String   // GREEN | YELLOW | RED
  ruleStatus  String
  aiStatus    String?
  reasons     Json     // [{source:"rule"|"ai", code, text_bn}]
  adviceBn    String
  @@index([patientId, createdAt])
}

model AiCache {
  key       String   @id   // hash of model + prompt + input
  response  Json
  createdAt DateTime @default(now())
}
```

---

## 5. Project layout

```
src/
  app/
    page.tsx                 # landing: start new patient / continue
    p/[id]/page.tsx          # patient home: status card, check-in, CBC, trend
    p/[id]/checkin/page.tsx
    p/[id]/cbc/page.tsx
    p/[id]/hospitals/page.tsx
    dashboard/page.tsx
  server/api/routers/        # patient, checkin, cbc, risk, dashboard, hospital
  lib/ai/                    # gemini.ts, groq.ts, prompts.ts, schemas.ts, withFallback.ts, cache.ts
  lib/risk/                  # who-rules.ts, score.ts, thresholds.ts
  lib/audio/toWav.ts
  lib/image/compress.ts
  lib/anomaly.ts
  components/                # StatusCard, SymptomChips, TrendChart, HospitalMap, Recorder
data/hospitals.json, data/areas.json
prisma/schema.prisma, prisma/seed.ts
scripts/fetch-hospitals.ts
public/manifest.webmanifest, public/audio/{green,yellow,red}.mp3
```

Packages: `@google/genai`, `groq-sdk`, `zod`, `leaflet`, `react-leaflet`, `recharts`, `vitest`; a PWA via a hand-written manifest (skip next-pwa; it's fragile with the App Router). Font: Noto Sans Bengali / Hind Siliguri via `next/font`.

---

## 6. Day-by-day plan (3 people)

Roles: **A** = AI + backend, **B** = frontend/UX, **C** = data, rules, dashboard, demo assets.

| | A (AI/backend) | B (frontend) | C (data/rules/dashboard) |
|---|---|---|---|
| **Day 0 (tonight)** | `pnpm create t3-app`, DB, deploy empty app to Vercel, get Gemini + Groq keys | Bangla UI wireframes, font, colour system | Read WHO 2009 + DGHS guideline, write thresholds; make synthetic CBC images |
| **Day 1** | Gemini wrapper with schema output, voice extraction endpoint, CBC endpoint, fallback + cache | Patient onboarding, recorder + WAV conversion, symptom chips confirm screen | `who-rules.ts` + Vitest cases, Prisma schema, `fetch-hospitals.ts` |
| **Day 2** | `score.ts` (rules + AI), Bangla advice generation, care coach | Status card, CBC upload + confirm, trend charts, hospital map | Seed script, anomaly z-score, dashboard page |
| **Day 3** | Prompt tuning on 20+ test recordings from all 3 members (different accents, noise), error handling | PWA manifest, mobile polish, loading/error states, tap-form fallback | Demo script, seed demo patient story (day 1 → day 4), slides, **record a backup demo video** |
| **Final (5 h)** | Only fixes; no new features | | Rehearse the 3-minute demo twice |

Freeze features at the end of Day 2. Day 3 is for reliability.

---

## 7. Possible barriers (and what to do about them)

### AI / free tier
1. **Gemini free-tier rate limits.** Per-minute and per-day request caps (check the current numbers in AI Studio; they change, and Pro models are much tighter than Flash). A 3-person team testing all day can burn the daily quota. *Fix:* use Flash / Flash-Lite, cache responses in `AiCache`, use separate API keys per teammate for development and a fresh one for the demo, and fall back to Groq automatically on HTTP 429.
2. **Free-tier data may be used by Google to improve products.** *Fix:* synthetic data only; say so in the pitch; mention paid tier or self-hosted model for a real launch.
3. **Bangla accuracy.** Regional accents (Noakhali, Chittagong, Sylhet), code-mixing ("platelet কমে গেছে"), background noise. Whisper on Groq is noticeably weaker than Gemini for Bangla. *Fix:* always show the extracted symptoms for confirmation, test with real voices early (Day 1), keep the tap-form fallback.
4. **LLM hallucinating numbers from CBC photos** (reading 15,000 as 150,000, mixing up reference range and result columns). *Fix:* ask for the result column explicitly, sanity ranges in code, mandatory user confirmation, `confidence` field.
5. **Handwritten or blurry reports.** Most Bangladeshi CBCs are printed, but photos are often skewed or glare-heavy. *Fix:* in-app tip ("flat, good light"), allow manual entry.
6. **Model names/versions change.** Free-tier model IDs get deprecated. *Fix:* keep the model ID in an env variable.

### Browser / device
7. **Web Speech API**: Chrome/Edge only (no Firefox, unreliable on iOS), needs internet, and audio goes to Google anyway. Treat it as an optional fallback, not the main path.
8. **Audio format mismatch** (WebM from Chrome, MP4 from Safari) vs Gemini's documented formats. *Fix:* client-side WAV conversion (section 3.1).
9. **Mic and camera need HTTPS.** Works on Vercel and localhost, fails on `http://192.168.x.x` when testing from a phone on LAN. *Fix:* test phones against the Vercel URL or a cloudflared/ngrok tunnel.
10. **No Bangla TTS voice on most Android phones.** *Fix:* pre-recorded MP3s for key alerts; text is always shown.
11. **Low-end phones / slow data.** *Fix:* compress images, short audio, small bundle, no heavy UI libraries.

### Platform / infra
12. **Vercel Hobby request body limit (about 4.5 MB)** and function timeout. A long WAV or full-size photo will fail. *Fix:* compress, cap length; if needed, upload to Supabase Storage first and send the URL.
13. **Prisma on serverless + Supabase**: connection exhaustion. *Fix:* use the pooled connection string (port 6543, `?pgbouncer=true`) as `DATABASE_URL` and the direct one as `directUrl` for migrations.
14. **Supabase free projects pause after about a week of inactivity.** *Fix:* open it the day before the final, or use Neon (scales to zero but wakes on request).
15. **Overpass API** is slow and rate-limited; OSM hospital data in Bangladesh is incomplete. *Fix:* fetch once, save JSON, hand-check the demo areas.
16. **Venue Wi-Fi** may be bad. *Fix:* mobile hotspot, the tap-form path, a pre-seeded demo patient, and a recorded backup video.

### Product / judging
17. **Medical safety questions.** *Fix:* AI can only raise, never lower the status; rules cited from WHO/DGHS; disclaimer "not a diagnosis"; escalate when data is missing.
18. **Rule thresholds being wrong.** *Fix:* cite every threshold; if possible, have a doctor (NSTU medical centre / a relative) glance at `thresholds.ts`.
19. **No auth means anyone with the link sees the patient.** Fine for a prototype; say "OTP login via phone number" is future work.
20. **Dashboard looks fake** because it is seeded. *Fix:* say openly that it uses synthetic data and show how real check-ins flow into it live during the demo.
21. **Scope creep.** WhatsApp bot, push notifications, offline mode and login are all out of scope for the 3 days.

---

## 8. Demo script (target 3 minutes)

1. Problem slide: 66 of 114 deaths within 24 h of admission.
2. New patient "Rahim, 9 years, Sonapur, fever day 1" → voice check-in → GREEN.
3. Upload day-2 CBC photo → values extracted → confirm → trend chart.
4. Jump to pre-seeded day 4: voice "জ্বর কমেছে কিন্তু পেট ব্যথা আর দুইবার বমি" + new CBC (HCT up, platelets 45k) → **RED** with reasons (rule + AI) and Bangla audio alert → nearest hospitals map.
5. Dashboard: Sonapur spike flagged.
6. Safety slide: rules over AI, confirmation, synthetic data.
