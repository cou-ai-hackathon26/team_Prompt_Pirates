import { THRESHOLDS as T } from "./risk/thresholds";

/**
 * Daily oral fluid target (ml) for home care.
 * - Adults (≥ 15 y): fixed target (WHO group A advice: plenty of oral fluids, ~2.5 L/day for adults).
 * - Children: Holliday-Segar maintenance (100 ml/kg first 10 kg, 50 ml/kg next 10 kg, 20 ml/kg above).
 *   If weight is unknown, it is estimated from age (APLS: (age + 4) × 2 for 1-10 y). PENDING DOCTOR REVIEW.
 */
export function fluidTargetMl(
  ageYears: number,
  weightKg: number | null | undefined,
): { ml: number; estimatedWeight: boolean } {
  if (ageYears >= T.fluids.adultFromAge)
    return { ml: T.fluids.adultTargetMl, estimatedWeight: false };
  const estimated = weightKg == null || weightKg <= 0;
  const kg = estimated ? estimateWeightKg(ageYears) : weightKg;
  const ml =
    Math.min(kg, 10) * 100 +
    Math.min(Math.max(kg - 10, 0), 10) * 50 +
    Math.max(kg - 20, 0) * 20;
  return {
    ml: Math.min(roundTo50(ml), T.fluids.adultTargetMl),
    estimatedWeight: estimated,
  };
}

export function estimateWeightKg(ageYears: number): number {
  if (ageYears < 1) return 7;
  if (ageYears <= 10) return (ageYears + 4) * 2;
  return 3 * ageYears + 7; // 11-14 y rough estimate
}

const roundTo50 = (n: number) => Math.round(n / 50) * 50;

/** Start of "today" in Bangladesh time (UTC+6), as a UTC Date. */
export function startOfDhakaDay(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 6 * 3600e3);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 6 * 3600e3);
}

export function dhakaHour(now = new Date()): number {
  return new Date(now.getTime() + 6 * 3600e3).getUTCHours();
}

/** Bangla display: 1250 -> "১.২৫ লিটার", 400 -> "৪০০ মিলি" (digits converted by caller). */
export function formatMl(ml: number): {
  value: string;
  unit: "লিটার" | "মিলি";
} {
  return ml >= 1000
    ? {
        value: String(Number((ml / 1000).toFixed(2))),
        unit: "লিটার",
      }
    : { value: String(ml), unit: "মিলি" };
}
