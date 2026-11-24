# DengueSathi: hackathon demo script (about 4 minutes)

## The day before / 30 minutes before

1. `pnpm db:seed` (the made-up dashboard data is dated relative to "now", so seed on demo day).
2. `pnpm demo:reset` (puts the demo patient রহিম (ডেমো) back on fever day 4 with days 1 to 3 green).
3. Open these tabs once so the free database and AI cache are warm:
   - `/` home, `/how-it-works`, `/p/demo-rahim`, `/dashboard`
4. `node scripts/warm-demo.mjs https://<your-app>.vercel.app` (or without a URL for localhost): pre-caches the 3 example sentences and all sample reports. Run it twice; the second run should show "already cached" everywhere.
5. Do one full rehearsal with the exact sentence and sample report below, then run `pnpm demo:reset` again.
   The AI answers are cached by input, so on stage the same sentence and the same sample image return instantly
   even if the free Gemini tier is slow. A new voice recording is never cached, so typing the sentence is the
   safest path; speaking is the impressive one.
6. Phone on mobile hotspot, laptop on the same hotspot. Have the backup screen recording ready.
7. Print `public/samples/cbc/demo-day4-shapla.pdf` to hold up on stage (it is marked SAMPLE).

## On stage

| Time | Show | Say (short) |
|---|---|---|
| 0:00 | Home page | "66 of 114 dengue deaths in a DGHS review happened within 24 hours of admission. Families arrive late because the fever drops on day 3 to 5 and they think the patient is recovering." |
| 0:30 | **কিভাবে কাজ করে** tab, let it play 20 s | "This is the whole flow in 45 seconds." (or skip if short on time) |
| 0:50 | `/p/demo-rahim` | "Rahim, 9, Sonapur. Days 1 to 3 were green. Today is day 4, the critical phase." |
| 1:10 | **আজকের আপডেট** → mic → say: *"জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে"* (backup: ⌨️ লিখে জানান → tap the first example) | "The mother just speaks Bangla. Gemini turns it into symptoms. She checks them." |
| 1:40 | Confirm → status turns **RED**, Bangla audio plays | "The WHO warning-sign rules decide. The AI can only raise the risk, never lower it. Every reason is labelled: WHO rule or AI." |
| 2:10 | **CBC রিপোর্ট** → 📄 নমুনা রিপোর্ট → *Demo patient, fever day 4* (or photograph the printout) | "She photographs the CBC. The AI reads platelets 45,000 and haematocrit 46, up 21% from day 2. Units are converted in code, impossible values are rejected." |
| 2:40 | Confirm → trend chart drops, more red reasons → **ডাক্তারের জন্য সারাংশ** | "And this is what changes the outcome: the family walks into the emergency room with a one-page clinical summary. Four days of symptoms, the platelet and haematocrit trend, every warning sign with a timestamp, in English for the doctor, plus a QR code for the live record. The doctor sees plasma leakage in five seconds instead of a panicked family trying to remember." |
| 3:00 | Back → **নিকটস্থ হাসপাতাল দেখুন** | "Nearest government hospitals, directions, 999." |
| 3:10 | `/dashboard` | "Hospitals see an anonymised area view. Sonapur has a spike: about 2 times its usual severe cases. They can prepare beds 48 hours early." |
| 3:40 | Close | "No diagnosis, no prescription: only when to go to hospital. Bangla voice, works for families who can't read lab reports. Built entirely on free tiers." |

## If something fails

| Problem | Do this |
|---|---|
| Mic blocked / noisy hall | ⌨️ লিখে জানান → tap the example sentence |
| AI slow (> 15 s) | Keep talking about the safety design; the app retries on a backup model automatically. Or use ☑️ চাপ দিয়ে জানান (tap form, no AI) |
| CBC read fails | ✍️ হাতে লিখুন: 45000, 46, 3100, 14.6 |
| Page error (database waking up) | Press আবার চেষ্টা করুন / refresh once |
| Internet down | Play the backup recording |

## Likely judge questions

- **"Is it safe for AI to give medical advice?"** It never diagnoses or prescribes. WHO 2009 warning-sign rules are hard-coded and always win; the AI can only escalate. Every AI-read value is confirmed by the family. When data is missing during days 3 to 7 it asks to see a doctor.
- **"How accurate is it?"** See `docs/VALIDATION_REPORT.md`: 14/14 synthetic CBC reports across 6 layouts and 4 unit styles (clean and phone-photo), 7/7 Bangla phrases incl. dialect and Banglish, 4/4 synthetic voice clips. Real-patient validation with doctors is the next step.
- **"Why would families use it?"** Voice in Bangla, no login, no app install (installable web app), works on any Android phone with Chrome.
- **"Privacy?"** Only area name, no address; CBC photos are not stored; dashboard is anonymised; prototype uses only synthetic data.
- **"Cost?"** Zero for the prototype (Gemini + Groq free tiers, Neon, Vercel). At scale: paid API or a self-hosted model.
