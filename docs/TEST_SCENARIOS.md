# DengueSathi: manual test scenarios

Use these to rehearse, and to prove to judges that each part works. Every scenario lists the steps
and the result you should see. Run on a phone (Chrome, Android) against https://dengusathi.vercel.app
unless noted.

**Before you start:** `pnpm db:seed` (fresh synthetic data + `demo-rahim`), then
`node scripts/warm-demo.mjs https://dengusathi.vercel.app` twice. For scenarios that write data, create a
throwaway patient (e.g. "টেস্ট রহিম, 9, ছেলে") so the demo patient stays clean, or run `pnpm demo:reset` after.

Sample reports used below are under CBC → "নমুনা রিপোর্ট" (all fictional):

| Sample | Printed patient | Values | Use it for |
|---|---|---|---|
| Demo patient, day 2 | Rahim Uddin, 9 Y, M | normal | demo-rahim history |
| Demo patient, day 4 | Rahim Uddin, 9 Y, M | platelets 45k, HCT up 21% | **RED** on demo-rahim |
| Analyzer printout | Nasrin Akter, 31 F | platelets 85k (x10³ units) | unit reading, wrong patient |
| Compact slip | Kamal Hossain, 45 M | normal (K/uL) | unit reading, wrong patient |
| Hospital lab | Sumaiya, 16 F | platelets 32k (x10⁹/L) | **wrong patient + danger** |
| Result after range | Abdul Malek, 68 M | platelets 1.2 lakh | reads result, not range |
| NS1 report | — | not a CBC | "not a CBC" message |

---

## A. New patient and area (all of Bangladesh)

| # | Steps | Expected |
|---|---|---|
| A1 | `/new` → tap **আমার এলাকা খুঁজুন** → allow location | Your upazila is chosen and shown with district + division, with "লোকেশন থেকে বাছাই করা হয়েছে" ("chosen from your location"). Only the area is stored. |
| A2 | Deny location permission | Amber message: "লোকেশনের অনুমতি দেওয়া হয়নি" ("location permission not given"), then search the name below. The form still works. |
| A3 | Search `begumgonj` (Banglish), `বেগমগঞ্জ`, `বেগমগন্জ` (misspelt) | All three find **বেগমগঞ্জ · নোয়াখালী জেলা**. |
| A4 | Search `নোয়াখালী` | Noakhali upazilas, **নোয়াখালী সদর** first. |
| A5 | Search `companiganj sylhet` | Sylhet's কোম্পানীগঞ্জ first, not Noakhali's (repeated names are disambiguated). |
| A6 | Search `chittagong kotwali`, `comilla` | Old English spellings work. |
| A7 | Open "তালিকা থেকে বেছে নিন" ("choose from list") → pick a district → pick an upazila | Selected. Districts are grouped by division. |
| A8 | Submit with no name / age 150 / no area | Inline Bangla errors, nothing sent. |
| A9 | Create a second patient on the same phone | Area pre-filled with the last one ("আগের:" chip). |

## B. Daily voice check-in (Challenge 1: one free-form message for the whole day)

| # | Steps | Expected |
|---|---|---|
| B1 | Patient page → আপডেট দিন → record a **long whole-day message** (60-120 s), e.g. "সকালে জ্বর ১০৩ ছিল, দুইবার বমি করছে। দুপুরে দাঁত দিয়ে একটু রক্ত পড়ছিল, এখন বন্ধ। বিকেল থেকে জ্বর নেই, পানি খাচ্ছে।" ("Fever was 103 in the morning, vomited twice. Some bleeding from the gums at noon, stopped now. No fever since afternoon, drinking water.") | Transcript shown. **সারা দিনের হিসাব** ("the day's account") timeline (সকাল / দুপুর / বিকেল, i.e. morning / noon / afternoon). Chips: gum bleeding ✔ (even though "stopped"), vomiting 2, temperature 103, "জ্বর হঠাৎ কমেছে" (fever suddenly dropped). Confirm → **RED**. |
| B2 | Keep recording past 1:45 | Amber "আর ১৫ সেকেন্ড বাকি" ("15 seconds left") countdown. Stops by itself at 2:00 and is still processed. |
| B3 | Say symptoms are absent: "বমি নেই, পেটে ব্যথা নেই, পানি খাচ্ছে" ("no vomiting, no stomach pain, drinking water") | Vomiting 0, pain "নেই" ("none"), can drink ✔ (negatives recorded, not left blank). |
| B4 | Say a danger word vaguely, or test when Gemini is slow (the backup model answers) | Fields the AI left empty but the words mention (বমি, রক্ত, প্রস্রাব, i.e. vomiting, blood, urine) are **highlighted yellow** for the family to check. |
| B5 | Deny the microphone | Clear Bangla message. "লিখে জানান" ("tell by typing") and "চাপ দিয়ে জানান" ("tell by tapping") still work. |
| B6 | Use "লিখে জানান" with an example sentence | Same flow as voice. |
| B7 | On the confirm screen, type temperature `১০১.৫` (Bangla keyboard), then `39` | Both accepted. 39 shows "সেলসিয়াস ধরে নেওয়া হলো = ১০২.২°F" ("taken as Celsius"). `120` shows a range error. |
| B8 | **Same day, second message:** after B1 (RED), send "এখন ভালো আছে, রক্ত পড়ে নাই, বমি নাই" ("fine now, no bleeding, no vomiting") | Still **RED**. A later "fine" cannot erase a danger sign from earlier that day. |

## C. Risk engine (WHO 2009 rules; AI can only raise)

| # | Steps | Expected |
|---|---|---|
| C1 | Example "জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই" ("fever 102, drinking water, no vomiting, no stomach pain") on fever day 1-2 | **GREEN**, home care advice. |
| C2 | "জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে" ("fever has dropped but severe stomach pain, vomited twice today") | **RED** (severe abdominal pain = WHO warning sign), reasons tagged "WHO 2009". |
| C3 | Patient aged 70 or pregnant, mild symptoms | At least **YELLOW** (risk factor). |
| C4 | Fever day 3-7 on the patient page | "সংকটকাল চলছে" ("critical phase") badge, days 3-7 highlighted. |
| C5 | Status card → 🔊 শুনুন ("listen") | Pre-recorded Bangla voice alert plays. |

## D. CBC report

| # | Steps | Expected |
|---|---|---|
| D1 | `demo-rahim` → CBC → sample **Demo patient, day 4** → confirm | Platelets 45,000, HCT 46, no identity question (same patient) → **RED**, with the HCT-rise reason. |
| D2 | **ছবি তুলুন** ("take photo") | Opens the camera. **ফাইল / গ্যালারি** ("file / gallery") opens the file picker (not forced camera). |
| D3 | Upload a PDF (e.g. `public/samples/cbc/demo-day4-shapla.pdf`) | PDF preview, values read. |
| D4 | Sample **NS1 report** | "এটা CBC রিপোর্ট নয়" ("this is not a CBC report") style message, nothing saved. |
| D5 | Sample **Result after range** | Reads the result column (1.2 lakh = 120,000), not the reference range. |
| D6 | Samples with x10³ / x10⁹/L / K/uL units | All converted to /µL correctly. |
| D7 | **হাতে লিখুন** ("type it in") → type values | Manual entry works without AI. Out-of-range values show errors. |

## E. Wrong patient (Challenge 2)

| # | Steps | Expected |
|---|---|---|
| E1 | Test patient "রহিম, 9, ছেলে" → CBC → sample **Hospital lab** (Sumaiya, 16 F, platelets 32k) → confirm | **"এই রিপোর্ট কি রহিম-এর?"** ("Is this report Rahim's?") with 3 differences (name, age 16 vs 9, female vs male). Nothing saved yet. |
| E2 | E1 → **না, অন্য কারো** ("no, someone else") | Red box: **"যার রিপোর্ট, তাকে এখনই হাসপাতালে নিন"** ("take the person this report belongs to to hospital now"), 16263 button, "নতুন রোগী যোগ করুন" ("add a new patient"). Patient page: no report saved, status unchanged. |
| E3 | E1 again → **হ্যাঁ, রহিম-এরই** ("yes, it's Rahim's") | Saved → **RED** (platelets 32k). Handoff card shows "Data conflicts … family confirmed it is this patient". |
| E4 | Voice/typed: "আমার আব্বার কথা বলতেছি, বয়স ৬৫। আজ জ্বরের পাঁচ দিন…" ("I'm talking about my father, age 65. Today is day 5 of the fever…") on a 9-year-old | **"এই কথাগুলো কি রহিম-এর?"** ("Are these words about Rahim?"), showing "কথায় বয়স ৬৫ বছর, রোগীর বয়স ৯ বছর" ("the message says 65 years, the patient is 9"). |
| E5 | Message about two children: "বড় ছেলের জ্বর, ছোটটার বমি" ("the elder son has fever, the younger one is vomiting") | Held: "কথায় একাধিক অসুস্থ মানুষের কথা আছে" ("the message mentions more than one sick person"). |
| E6 | Sample **Demo patient day 4** on `demo-rahim` | **No** question (Rahim Uddin = রহিম, same age and sex): no false alarms for the right patient. |

## F. Contradictions (Challenge 2)

| # | Steps | Expected |
|---|---|---|
| F1 | Test patient: typed "ভালো আছে, পানি খাচ্ছে, বমি নেই" ("doing well, drinking water, no vomiting") → then CBC **হাতে লিখুন** ("type it in") platelets 30000 | **RED** (platelets) plus a reason: "কথায় রোগী ভালো আছে, কিন্তু প্লাটিলেট মাত্র ৩০,০০০…" ("the message says the patient is well, but platelets are only 30,000…"). The lab is given priority. |
| F2 | Test patient: typed "দাঁত দিয়ে রক্ত পড়ছে" ("gums are bleeding") → CBC manual platelets 220000, HCT 40 | Stays **RED** (symptom), with the note "লক্ষণ গুরুতর, কিন্তু রিপোর্ট স্বাভাবিক…" ("severe symptoms, but the report is normal…"). |
| F3 | CBC manual platelets 30000 today → then another CBC manual platelets 180000 (same day) | Not lowered to GREEN. Reason "এত দ্রুত বাড়া অস্বাভাবিক… ঝুঁকি কমানো হয়নি" ("rising this fast is unusual… risk not lowered"), at least **YELLOW**. |
| F4 | Typed "আজ জ্বরের সাত দিন" ("today is day 7 of the fever") when the record says day 3 | Saved, and the handoff card lists "Caregiver says fever day 7, record says day 3". |
| F5 | CBC date set to a future date / before the fever | Handoff card lists the date conflict. |

## G. Doctor handoff, reminders, fluids, hospitals

| # | Steps | Expected |
|---|---|---|
| G1 | Patient page → "ডাক্তারের জন্য সারাংশ" ("summary for the doctor") | English one-page card: area in English, status and reasons (WHO vs app rule), lab table with HCT Δ, symptom log, fluids, **Data conflicts**, QR code. Print preview fits on one A4 page. |
| G2 | Scan the QR on another phone | Opens the same patient (link sharing works, no login). |
| G3 | "রিমাইন্ডার" (reminder) / .ics | Calendar adds 9 am and 8 pm reminders through fever day 7. |
| G4 | Fluid tracker: tap glass / ORS, then undo | Total and progress update. On day 3-7 after 6 pm below 50% → LOW_FLUIDS reason. |
| G5 | Hospitals with location allowed / denied | Nearest hospitals by GPS, or from the area centre. Public/emergency ones first. 999 / 16263 shown. **Known gap until task 5: outside the demo areas the list may be far away.** |

## H. Hospital dashboard (`/dashboard`, laptop)

| # | Steps | Expected |
|---|---|---|
| H0 | Open `/dashboard` signed out, then **Google দিয়ে স্টাফ লগইন** | Lock screen first ("শুধু হাসপাতাল ও স্বাস্থ্য কর্মকর্তাদের জন্য"); after Google sign-in the dashboard opens with your email and a লগআউট button. An account not in `STAFF_EMAILS` sees "এই অ্যাকাউন্টের অনুমতি নেই". Patient pages never ask for login. |
| H1 | Open after a fresh seed | Red alert banner for **সোনাপুর, নোয়াখালী** (Sonapur spike), KPI cards with sparklines, map, 15-day chart. |
| H2 | Switch উপজেলা ↔ জেলা (upazila ↔ district) | Map circles and table change level. Totals stay the same. |
| H3 | Division filter → চট্টগ্রাম / ঢাকা (Chattogram / Dhaka) | KPIs, chart, map and table show only that division. |
| H4 | Keep the dashboard open on the projector, make a RED check-in on the phone | Within 20 s the RED count goes up (live refresh). |
| H5 | "সব … দেখুন" ("see all") | Expands the table beyond 12 rows. |

## J. Optional family login (Google)

| # | Steps | Expected |
|---|---|---|
| J1 | New patient → first result (GREEN/YELLOW) | Under the status card: **"রোগীর তথ্য হারাবেন না"** card with "Google দিয়ে সেভ করুন" / "পরে". Never shown on a RED result, during check-in or CBC. |
| J2 | Tap **পরে** | Card disappears and stays hidden for 3 days (also after reload). The app works fully without login. |
| J3 | Tap **Google দিয়ে সেভ করুন** → sign in | Back on the same patient page; the card becomes "✓ <email> অ্যাকাউন্টে সেভ করা আছে". |
| J4 | Second phone (or incognito) → home → **"আগে রোগী যোগ করেছেন? Google দিয়ে খুঁজুন"** → sign in with the same account | Home shows **আমার রোগী** with the patient, its fever day, area and status dot. Tap → patient page. |
| J5 | Signed in, open a shared patient link from WhatsApp | It is added to "আমার রোগী" automatically. |
| J6 | Sign in with a family account (not in STAFF_EMAILS) → `/dashboard` | "এই অ্যাকাউন্টের অনুমতি নেই": families never see the hospital dashboard. |

## I. Resilience and honesty checks (good answers to judges)

| # | Steps | Expected |
|---|---|---|
| I1 | Ask "what if the AI is down?" → use the tap form | Rules still decide the status. The AI is optional. |
| I2 | Second run of a sample report | Answers in ~1 s (Postgres AI cache). |
| I3 | `/how-it-works` | Auto-playing walkthrough, no interaction needed. |
| I4 | `pnpm test` on a laptop | 113 tests pass (rules, CBC parsing, areas, merge, consistency, temperature…). |

---

## Suggested 6-minute judge run

0. **Before going on stage:** sign in to `/dashboard` on the laptop (H0) so no login popup is needed live.
1. **Problem (30 s):** the dashboard H1, Sonapur spike.
2. **Challenge 1 (90 s):** B1 live on stage (long whole-day voice) → timeline → RED, then B8 ("এখন ভালো আছে", "fine now") stays RED.
3. **CBC (60 s):** D1 on demo-rahim → RED with HCT rise.
4. **Challenge 2 (90 s):** E1 → E2 (wrong-patient report, "take that person to hospital"), then F1 (fine words vs low platelets).
5. **Doctor (30 s):** G1 handoff card with Data conflicts and the QR code.
6. **Close (30 s):** H4 live refresh, nationwide area picker (A3 + A1).
