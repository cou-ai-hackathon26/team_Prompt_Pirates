import type { Symptoms } from "./schemas";

/**
 * Deterministic safety net on top of the AI extraction.
 * If the caregiver's words mention a danger sign but the model left that field empty (null),
 * we do NOT guess a value (negations like "পেটে ব্যথা নেই" are common); we flag the field as
 * "unclear" so the confirm screen highlights it and the family decides. This catches model misses
 * (e.g. the backup model dropping "পেট ব্যথা") regardless of which AI answered.
 */
const CHECKS: { fields: (keyof Symptoms)[]; pattern: RegExp }[] = [
  {
    fields: ["abdominalPain"],
    pattern:
      /পেট(ে|ের)?\s*(খুব\s*)?(ব্যথা|ব্যাথা|বেথা|বাথা|কামড়)|তলপেট|stomach|abdom|pet\s*(e\s*)?bat?ha/i,
  },
  { fields: ["vomitingCount24h"], pattern: /বমি|বোমি|বামি|ওয়াক|vomit|bomi/i },
  {
    fields: [
      "bleedingGums",
      "bleedingNose",
      "vomitBlood",
      "blackStool",
      "heavyMenstrualBleeding",
      "bleedingOther",
    ],
    pattern: /রক্ত|রক্তপাত|কালো\s*পায়খানা|কালা\s*পায়খানা|blood|bleed|rokto/i,
  },
  {
    fields: ["drowsyOrRestless"],
    pattern: /ঝিম|জিমা|অস্থির|নিস্তেজ|অজ্ঞান|শুধু\s*ঘুম|drows|restless|jhim/i,
  },
  { fields: ["noUrine6h"], pattern: /প্রস্রাব|পেশাব|পেসাব|প্রসাব|পস্রা|urine|prosrab/i },
  { fields: ["coldClammyHands"], pattern: /ঠান্ডা|ঠাণ্ডা|cold|thanda/i },
  // Whisper (the backup speech model) often writes these misspellings; caught above too:
  // "বোমি" (বমি), "পস্রা" (প্রস্রাব), "জিমাচ্ছে" (ঝিমাচ্ছে).
  {
    fields: ["breathingDifficulty"],
    pattern: /শ্বাস|নিঃশ্বাস|দম\s*(বন্ধ|নিতে)|breath|shash/i,
  },
  {
    fields: ["canDrinkFluids"],
    pattern: /খেতে\s*পার|খাইতে\s*পার|পানি\s*খা|drink|kheta?\s*par/i,
  },
];

export function flagMissedDangerSigns(
  transcript: string,
  symptoms: Symptoms,
  unclear: string[],
): string[] {
  const out = new Set(unclear);
  for (const { fields, pattern } of CHECKS) {
    if (!pattern.test(transcript)) continue;
    const allEmpty = fields.every((f) => symptoms[f] == null);
    if (allEmpty) for (const f of fields) out.add(f);
  }
  return [...out];
}
