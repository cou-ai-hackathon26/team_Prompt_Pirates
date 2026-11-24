# DengueSathi: clinical rule review sheet (≈ 20 minutes)

**For:** a physician / paediatrician who treats dengue in Bangladesh
**From:** Team Prompt_Pirates, NSTU (hackathon prototype)

DengueSathi is a home-monitoring app for families of dengue patients. It does **not** diagnose or prescribe.
It only decides how urgently the family should seek care:

- **GREEN**: continue home care
- **YELLOW**: see a doctor today
- **RED**: go to hospital now

The status comes from the hard-coded rules below. An AI model may only make the status *more* urgent, never less.
We would be grateful for a quick review: tick **Agree**, or write the value or wording you would use.
Your name will be credited as a reviewer only if you allow it.

Rules live in `src/lib/risk/thresholds.ts` and `src/lib/risk/who-rules.ts`.

---

## A. Symptoms reported by the family → RED (go to hospital now)

Most of these follow the WHO 2009 warning signs.

| # | Rule | Source | Agree? | Your change / comment |
|---|---|---|---|---|
| A1 | Severe abdominal pain | WHO 2009 warning sign | ☐ | |
| A2 | Vomiting **≥ 3 times in 24 h** = "persistent vomiting" | WHO says "persistent"; **3/24 h is our choice** | ☐ | |
| A3 | Vomiting blood, or black stool | Bleeding | ☐ | |
| A4 | Gum or nose bleeding, or heavy menstrual bleeding | WHO: mucosal bleeding | ☐ | |
| A4b | **Any other bleeding, or bleeding mentioned without a site** (e.g. "রক্তপাত আছে") | Our conservative choice | ☐ | |
| A5 | Lethargy, excessive sleepiness or restlessness | WHO warning sign | ☐ | |
| A6 | Cold clammy hands or feet | Shock sign | ☐ | |
| A7 | No urine for **≥ 6 h** | Our threshold | ☐ | |
| A8 | Cannot drink or keep fluids down | WHO group B criterion | ☐ | |
| A9 | Breathing difficulty | Fluid accumulation / shock | ☐ | |

## B. Symptoms → YELLOW (see a doctor today)

| # | Rule | Source | Agree? | Your change / comment |
|---|---|---|---|---|
| B1 | Mild abdominal pain | Our choice | ☐ | |
| B2 | Vomiting 1-2 times in 24 h | Our choice | ☐ | |
| B3 | Red spots / petechiae on skin | Our choice | ☐ | |
| B4 | Dizziness on standing | Our choice | ☐ | |
| B5 | Fever has just dropped **during days 3-7** (critical phase) | WHO critical phase | ☐ | |
| B6 | No update from the family for **> 24 h** during days 3-7 | Our choice | ☐ | |
| B7 | High-risk patient: age **< 1 y** or **≥ 65 y**, pregnancy, diabetes, kidney or heart disease, obesity | WHO co-existing conditions | ☐ | |
| B8 | During days 3-7, if the family is logging fluids and has drunk **< 50 % of the daily target by 6 pm** → YELLOW | Our choice | ☐ | |

## C. Lab results (CBC)

| # | Rule | Source | Agree? | Your change / comment |
|---|---|---|---|---|
| C1 | Platelets **< 50,000/µL** → RED | **Our threshold**; WHO has no single platelet cut-off as a warning sign | ☐ | |
| C2 | Platelets **≤ 100,000/µL** → YELLOW | WHO: severity marker in the critical phase | ☐ | |
| C3 | HCT rise **≥ 20 %** from the first recorded value → RED | WHO: plasma leakage | ☐ | |
| C4 | HCT rise **10-20 %** together with platelets falling > 10 % since the last test → RED | WHO: rising HCT with rapid platelet fall | ☐ | |
| C5 | HCT rise 10-20 % without falling platelets → YELLOW | Our choice | ☐ | |
| C6 | Baseline HCT is the first value entered in the app. Is that acceptable when no pre-illness HCT is known? | Our assumption | ☐ | |

## D. Advice shown to families (Bangla)

| # | Text | Agree? | Your change / comment |
|---|---|---|---|
| D1 | Drink at least 2.5-3 L/day: water, ORS, coconut water, soup (adult) | ☐ | |
| D2 | For fever, paracetamol only. **No ibuprofen or aspirin.** | ☐ | |
| D3 | RED: go now; give small sips of ORS or water on the way | ☐ | |
| D4 | Daily fluid target: adults (≥ 15 y) 2,500 ml; children by Holliday-Segar (100 ml/kg for the first 10 kg, 50 ml/kg for the next 10 kg, 20 ml/kg above), weight estimated as (age + 4) × 2 when unknown | ☐ | |

## E. Open questions

1. Is anything missing that should trigger RED? (For example liver tenderness, which a family cannot assess.)
2. For children, should the fluid target be weight-based, and which formula do you use?
3. Would an emergency-department doctor find the one-page handoff summary (`/p/<id>/handoff`) useful? What would you add or remove?

---

**Reviewer:** ______________________ **Designation / hospital:** ______________________

**Date:** ____________ **May we credit you by name in the presentation?** ☐ Yes ☐ No

**Overall comment:**

&nbsp;

&nbsp;
