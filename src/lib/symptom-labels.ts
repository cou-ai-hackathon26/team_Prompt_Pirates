import type { Symptoms } from "~/lib/ai/schemas";
import { toBn } from "~/lib/bn";

export { toBn };

type BoolKey = {
  [K in keyof Symptoms]: Symptoms[K] extends boolean | null ? K : never;
}[keyof Symptoms];

/** Yes/no symptoms shown as toggle chips. `danger` = WHO warning sign (RED if present). */
export const BOOL_SYMPTOMS: {
  key: BoolKey;
  label: string;
  danger?: boolean;
  invert?: boolean;
}[] = [
  { key: "fever", label: "জ্বর আছে" },
  { key: "feverJustDropped", label: "জ্বর হঠাৎ কমেছে" },
  {
    key: "canDrinkFluids",
    label: "পানি/তরল খেতে পারছে না",
    danger: true,
    invert: true,
  },
  { key: "noUrine6h", label: "৬ ঘণ্টা প্রস্রাব হয়নি", danger: true },
  { key: "drowsyOrRestless", label: "ঝিমুনি বা অস্থিরতা", danger: true },
  { key: "coldClammyHands", label: "হাত-পা ঠান্ডা, ভেজা", danger: true },
  { key: "bleedingGums", label: "মাড়ি দিয়ে রক্ত", danger: true },
  { key: "bleedingNose", label: "নাক দিয়ে রক্ত", danger: true },
  { key: "vomitBlood", label: "বমিতে রক্ত", danger: true },
  { key: "blackStool", label: "কালো পায়খানা", danger: true },
  { key: "heavyMenstrualBleeding", label: "অতিরিক্ত মাসিক", danger: true },
  { key: "bleedingOther", label: "অন্য কোথাও রক্তপাত", danger: true },
  { key: "breathingDifficulty", label: "শ্বাসকষ্ট", danger: true },
  { key: "skinSpots", label: "চামড়ায় লাল দাগ" },
  { key: "dizzyOnStanding", label: "দাঁড়ালে মাথা ঘোরে" },
];

export const PAIN_LABEL = {
  none: "নেই",
  mild: "হালকা",
  severe: "তীব্র",
} as const;

/** Short Bangla summary chips for a stored check-in. */
export function summarizeSymptoms(
  s: Symptoms,
): { text: string; danger: boolean }[] {
  const out: { text: string; danger: boolean }[] = [];
  if (s.temperatureF)
    out.push({ text: `জ্বর ${toBn(s.temperatureF)}°F`, danger: false });
  if (s.abdominalPain && s.abdominalPain !== "none")
    out.push({
      text: `পেটব্যথা: ${PAIN_LABEL[s.abdominalPain]}`,
      danger: s.abdominalPain === "severe",
    });
  if (s.vomitingCount24h)
    out.push({
      text: `বমি ${toBn(s.vomitingCount24h)} বার`,
      danger: s.vomitingCount24h >= 3,
    });
  for (const b of BOOL_SYMPTOMS) {
    const v = s[b.key];
    if (b.key === "fever" && s.temperatureF) continue;
    if (b.invert ? v === false : v === true)
      out.push({ text: b.label, danger: !!b.danger });
  }
  return out;
}
