import type { Symptoms } from "~/lib/ai/schemas";

/** English clinical wording for the doctor-facing handoff (the family UI stays Bangla). */
export const SYMPTOM_EN: Partial<Record<keyof Symptoms, string>> = {
  fever: "Fever",
  feverJustDropped: "Defervescence (fever just dropped)",
  bleedingGums: "Gum bleeding",
  bleedingNose: "Epistaxis",
  vomitBlood: "Haematemesis",
  blackStool: "Melaena",
  skinSpots: "Petechiae / rash",
  heavyMenstrualBleeding: "Menorrhagia",
  bleedingOther: "Bleeding, other / site not stated",
  noUrine6h: "No urine ≥ 6 h",
  drowsyOrRestless: "Lethargy / restlessness",
  coldClammyHands: "Cold clammy extremities",
  canDrinkFluids: "Unable to tolerate oral fluids",
  breathingDifficulty: "Breathing difficulty",
  dizzyOnStanding: "Postural dizziness",
};

/** One-line English summary of a check-in, with WHO warning signs flagged. */
export function symptomsEn(s: Symptoms): { text: string; warning: boolean }[] {
  const out: { text: string; warning: boolean }[] = [];
  if (s.temperatureF != null)
    out.push({ text: `Temp ${s.temperatureF}°F`, warning: false });
  if (s.abdominalPain && s.abdominalPain !== "none")
    out.push({
      text: `Abdominal pain: ${s.abdominalPain}`,
      warning: s.abdominalPain === "severe",
    });
  if (s.vomitingCount24h != null && s.vomitingCount24h > 0)
    out.push({
      text: `Vomiting ×${s.vomitingCount24h}/24h`,
      warning: s.vomitingCount24h >= 3,
    });
  if (s.fluidIntakeLitres != null)
    out.push({
      text: `Oral fluids ~${s.fluidIntakeLitres} L/day`,
      warning: false,
    });
  const WARN = new Set<keyof Symptoms>([
    "bleedingGums",
    "bleedingNose",
    "vomitBlood",
    "blackStool",
    "heavyMenstrualBleeding",
    "bleedingOther",
    "noUrine6h",
    "drowsyOrRestless",
    "coldClammyHands",
    "canDrinkFluids",
    "breathingDifficulty",
  ]);
  for (const [k, label] of Object.entries(SYMPTOM_EN) as [
    keyof Symptoms,
    string,
  ][]) {
    if (k === "fever" && s.temperatureF != null) continue;
    const v = s[k];
    const present = k === "canDrinkFluids" ? v === false : v === true;
    if (present) out.push({ text: label, warning: WARN.has(k) });
  }
  return out;
}

/**
 * Rule codes that are WHO 2009 dengue warning signs (or direct WHO criteria). Everything else is an
 * app-specific rule pending clinician review (see docs/DOCTOR_REVIEW.md), and must not be labelled "WHO".
 */
export const WHO_RULE_CODES = new Set([
  "SEVERE_ABDOMINAL_PAIN",
  "PERSISTENT_VOMITING",
  "MUCOSAL_BLEEDING",
  "LETHARGY_RESTLESSNESS",
  "HCT_RISE_HIGH",
  "HCT_UP_PLT_DOWN",
  "FEVER_DROP_CRITICAL",
  "CANNOT_DRINK",
  "HIGH_RISK_PATIENT",
  "PLATELET_LOW",
]);

/** English text for rule codes in RiskAssessment.reasons. */
export const REASON_EN: Record<string, string> = {
  SEVERE_ABDOMINAL_PAIN: "Severe abdominal pain (WHO warning sign)",
  PERSISTENT_VOMITING: "Persistent vomiting ≥3/24h (WHO warning sign)",
  VOMIT_BLOOD: "Haematemesis",
  BLACK_STOOL: "Melaena",
  ANY_BLEEDING: "Bleeding reported (site not stated / other)",
  DATA_CONFLICT: "Contradictory data (see Data conflicts); raised to at least YELLOW",
  MUCOSAL_BLEEDING: "Mucosal bleeding (WHO warning sign)",
  LETHARGY_RESTLESSNESS: "Lethargy / restlessness (WHO warning sign)",
  COLD_CLAMMY: "Cold clammy extremities (possible shock)",
  NO_URINE_6H: "No urine ≥ 6 h",
  CANNOT_DRINK: "Unable to tolerate oral fluids",
  BREATHING: "Breathing difficulty",
  MILD_ABDOMINAL_PAIN: "Mild abdominal pain",
  SOME_VOMITING: "Vomiting (1-2 episodes)",
  SKIN_SPOTS: "Petechiae / rash",
  DIZZY: "Postural dizziness",
  FEVER_DROP_CRITICAL: "Defervescence during critical phase (day 3-7)",
  MISSED_CHECKIN: "No home update for > 24 h during critical phase",
  PLATELET_VERY_LOW: "Platelets < 50,000/µL",
  PLATELET_LOW: "Platelets ≤ 100,000/µL",
  HCT_RISE_HIGH: "HCT rise ≥ 20% from baseline (plasma leakage)",
  HCT_UP_PLT_DOWN:
    "Rising HCT with rapidly falling platelets (WHO lab warning sign)",
  HCT_RISE: "HCT rise 10-20% from baseline",
  HIGH_RISK_PATIENT: "High-risk group (age / pregnancy / comorbidity)",
  AI_TREND: "AI trend review",
};

export const RISK_FACTOR_EN: Record<string, string> = {
  pregnant: "Pregnant",
  diabetes: "Diabetes",
  kidney: "Kidney disease",
  heart: "Heart disease",
  obesity: "Obesity",
};
