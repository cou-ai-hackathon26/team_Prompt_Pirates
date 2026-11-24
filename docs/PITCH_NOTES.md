# DengueSathi: pitch notes (impact, distribution, slides, Q&A)

Rule for every number on a slide: either it has a source, or it is labelled **assumption** and shown as a
parameter the judges can change. Never present a modelled number as a measured one.

---

## 1. The one-line story

> Most dengue deaths in Bangladesh are not a hospital-capacity problem but a **timing** problem: families bring
> patients too late, because the fever drops in the critical phase (days 3-7) and they think the patient is
> recovering. DengueSathi watches those days at home, in Bangla voice, and tells the family exactly when to go.
> When it says go, the emergency doctor gets a one-page clinical summary instead of a panicked family.

## 2. Sourced facts (from the proposal research; re-check links before the final)

| Fact | Source |
|---|---|
| 66 of 114 reviewed dengue deaths (~58%) occurred within 24 h of admission | DGHS death review, 2025 (TBS News / Asia News Network reports) |
| Only 21 of those 114 were admitted on fever days 1-3 | Same DGHS review |
| 132,948 cases and 384 deaths by 25 Oct 2026, about double 2025 | DGHS figures via Dhaka Tribune / Arab News |
| Critical phase = days 3-7, around defervescence; warning signs listed | WHO 2009 dengue guidelines |

## 3. Impact model (illustrative, assumptions visible)

Only change the yellow cells, never the sourced ones.

```
Deaths per season                         D  = 384             (sourced, 2026 to 25 Oct)
Share of deaths with late admission       L  = 0.58            (sourced: died < 24 h after admission)
Share of home patients reached by app     R  = 0.10            ASSUMPTION (year-1 pilot reach)
Share of reached late cases that the app
  gets to hospital ≥ 24 h earlier          E  = 0.30            ASSUMPTION (to be measured in a pilot)
Mortality reduction when admitted earlier M  = 0.50            ASSUMPTION (clinician to confirm)

Deaths potentially averted ≈ D × L × R × E × M  =  384 × 0.58 × 0.10 × 0.30 × 0.50  ≈  3.3 per season
```

Say it honestly: *"Even at 10% reach, the model suggests about 3 lives a season; at national scale (R = 0.5) about
17. Every parameter is shown, and the pilot is designed to measure E."* Judges respect a transparent small number
far more than an unexplained big one.

Secondary impacts (no numbers needed):
- **Fewer unnecessary admissions**: GREEN patients stay home and free beds during surges.
- **Faster triage**: the handoff card shows the HCT trend and warning signs with timestamps.
- **Early warning for upazila hospitals**: area spikes appear on the dashboard 24-48 h before the patients arrive.

**Cost per monitored patient:** measure, don't guess. Log tokens per check-in and per CBC read (Gemini returns
usage metadata), then multiply by the paid-tier price. The prototype runs at ৳0 on free tiers.

## 4. Distribution: "how do families find it?"

The best answer is to use a point every dengue patient already passes through.

1. **Diagnostic centres:** every suspected case gets a CBC / NS1 test. Print a QR code on the report:
   *"ডেঙ্গু পজিটিভ? প্রতিদিন বাসায় খোঁজ রাখুন: স্ক্যান করুন"* ("Dengue positive? Keep track at home every day: scan here").
   Labs gain a free patient-safety service; the app gets the user at exactly the right moment (day 1-3).
2. **Doctors and OPD:** a small slip with the QR code, handed out with the prescription for home-managed (group A) patients.
3. **DGHS / Shastho Batayon 16263:** the hotline can send the link by SMS to dengue callers.
4. **Later:** a WhatsApp number (no install) and an IVR phone line for households without smartphones.

## 5. Slide outline (8 slides, about 4 minutes with the live demo)

1. **Hook:** 66 of 114. One photo or quote from a real family (*collect this week*).
2. **Why:** fever drops, family relaxes, critical phase, late arrival. The day 1-7 risk strip.
3. **Solution:** voice check-in → CBC photo → GREEN / YELLOW / RED → hospital + handoff card.
4. **Live demo** (see DEMO_SCRIPT.md).
5. **Why AI is essential:** speech-to-symptoms for low-literacy users (15 s of talking vs 2 min of forms), lab-photo
   reading with unit conversion, trend review; **plus** WHO rules that the AI can never override.
6. **Evidence:** the real-data validation table (real CBC photos and real voices, honest misses) and the doctor's review.
7. **Impact and distribution:** the model above, the lab-QR channel, and the hospital dashboard.
8. **Ask / next steps:** a 1-month pilot with one upazila health complex plus two diagnostic centres, measuring E.

## 6. Judge Q&A (short, honest answers)

| Question | Answer |
|---|---|
| Isn't AI medical advice dangerous? | The AI never diagnoses or prescribes. It only transcribes and reads; the rules decide the minimum urgency, and the AI can only raise it. Every AI-read value is confirmed by the family. Thresholds were reviewed by Dr. ___ (fill in). |
| How accurate is it? | Show the real-data table, including the misses and how the confirmation step caught them. Synthetic test results are a supplement, not the headline. |
| Why would a family keep using it for 7 days? | It takes 15 seconds a day by voice. The day 3-7 strip and the fluid tracker give them something to do; reminders (WhatsApp) come next. |
| What if they don't have a smartphone? | Today: any family member's phone, via a link with no install. Next: WhatsApp voice notes and an IVR line; the AI pipeline stays the same. |
| Data privacy? | Area name only, no address; report photos are not stored; the dashboard is anonymised; no login means no account data. Production: OTP login and encryption at rest. |
| What happens when the AI is down? | The tap-form check-in and manual lab entry work without AI, and the rules still run. The AI review has a 10 s budget, after which rules and standard advice are used. |
| How is this different from existing dengue apps? | Others inform or log once. We follow the patient day by day through the critical phase, in Bangla voice, read the labs families already have, and hand a clinical summary to the ER. |
| Business model? | A public-health service: DGHS / NGO funded; diagnostic centres sponsor it as a value-add; cost per patient is a few taka in API fees (show the measured number). |
