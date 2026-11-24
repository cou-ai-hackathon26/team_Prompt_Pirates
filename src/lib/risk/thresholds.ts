/**
 * All clinical thresholds live here so they can be reviewed in one place.
 *
 * Sources (verify each value before the demo, and ideally have a doctor review this file):
 * - WHO (2009) Dengue: Guidelines for diagnosis, treatment, prevention and control.
 *   Warning signs: abdominal pain/tenderness, persistent vomiting, clinical fluid accumulation,
 *   mucosal bleeding, lethargy/restlessness, liver enlargement > 2 cm,
 *   lab: increase in HCT concurrent with rapid decrease in platelet count.
 * - DGHS Bangladesh, National Guideline for Clinical Management of Dengue Syndrome.
 *
 * Values marked PROTOTYPE are pragmatic choices for this app, not guideline numbers.
 */
export const THRESHOLDS = {
  /** Critical phase usually spans fever days 3-7 (WHO 2009). */
  criticalPhaseStartDay: 3,
  criticalPhaseEndDay: 7,

  /** "Persistent vomiting" — PROTOTYPE operationalisation: 3+ episodes in 24 h. */
  persistentVomitingCount: 3,

  /** Platelets (per microlitre). */
  plateletRed: 50_000, // PROTOTYPE: below this -> hospital
  plateletYellow: 100_000, // WHO: <= 100,000 is a marker of severity in the critical phase

  /** Haematocrit rise relative to baseline (first recorded value), in percent of baseline. */
  hctRiseRedPct: 20, // WHO: >= 20% rise indicates plasma leakage
  hctRiseYellowPct: 10, // PROTOTYPE

  /** No check-in during critical phase for this many hours -> YELLOW. PROTOTYPE */
  missedCheckInHours: 24,

  /** Oral fluids (home care). PROTOTYPE values, listed for doctor review in docs/DOCTOR_REVIEW.md. */
  fluids: {
    adultFromAge: 15,
    adultTargetMl: 2500,
    /** After this local hour, intake below `lowFraction` of target in the critical phase -> YELLOW */
    checkAfterHour: 18,
    lowFraction: 0.5,
  },

  /** Age-based risk (WHO lists infants and elderly as co-existing conditions). */
  infantMaxAgeYears: 1,
  elderlyMinAgeYears: 65,

  /** Sanity ranges for values read from photos; outside = reject and ask user to type. */
  sanity: {
    plateletMin: 1_000,
    plateletMax: 1_500_000,
    hctMin: 10,
    hctMax: 70,
    wbcMin: 300,
    wbcMax: 100_000,
    hbMin: 3,
    hbMax: 22,
  },
} as const;

export const HIGH_RISK_FACTORS = [
  "pregnant",
  "diabetes",
  "kidney",
  "heart",
  "obesity",
] as const;
