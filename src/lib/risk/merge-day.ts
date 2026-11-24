import type { Symptoms } from "~/lib/ai/schemas";

/** Symptoms where `true` is the dangerous value. */
const DANGER_TRUE: (keyof Symptoms)[] = [
  "fever",
  "feverJustDropped",
  "bleedingGums",
  "bleedingNose",
  "vomitBlood",
  "blackStool",
  "skinSpots",
  "heavyMenstrualBleeding",
  "bleedingOther",
  "noUrine6h",
  "drowsyOrRestless",
  "coldClammyHands",
  "breathingDifficulty",
  "dizzyOnStanding",
];
const PAIN_RANK = { none: 0, mild: 1, severe: 2 } as const;

const maxNum = (a: number | null, b: number | null) =>
  a == null ? b : b == null ? a : Math.max(a, b);

/**
 * Combine all of one day's check-ins into the day's picture, keeping the WORST of each symptom.
 * A later message ("এখন ভালো আছে") can add information but never erases an earlier danger sign,
 * and a field left unmentioned (null) later in the day keeps its earlier value.
 * Input order does not matter.
 */
export function mergeDaySymptoms(list: Symptoms[]): Symptoms {
  if (list.length === 0) throw new Error("mergeDaySymptoms needs at least one check-in");
  const [first, ...rest] = list;
  const out: Symptoms = { ...first! };
  for (const s of rest) {
    for (const k of DANGER_TRUE) {
      const a = out[k] as boolean | null;
      const b = s[k] as boolean | null;
      (out[k] as boolean | null) = a === true || b === true ? true : (a ?? b);
    }
    out.temperatureF = maxNum(out.temperatureF, s.temperatureF);
    // Each check-in reports its own "last 24 h" count; the larger one is the safer estimate.
    out.vomitingCount24h = maxNum(out.vomitingCount24h, s.vomitingCount24h);
    out.fluidIntakeLitres = maxNum(out.fluidIntakeLitres, s.fluidIntakeLitres);
    out.abdominalPain =
      out.abdominalPain == null
        ? s.abdominalPain
        : s.abdominalPain == null
          ? out.abdominalPain
          : PAIN_RANK[s.abdominalPain] > PAIN_RANK[out.abdominalPain]
            ? s.abdominalPain
            : out.abdominalPain;
    // Not being able to drink is the danger value here.
    out.canDrinkFluids =
      out.canDrinkFluids === false || s.canDrinkFluids === false
        ? false
        : (out.canDrinkFluids ?? s.canDrinkFluids);
  }
  return out;
}
