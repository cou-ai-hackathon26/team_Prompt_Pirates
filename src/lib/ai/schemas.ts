import { z } from "zod";

/**
 * Symptoms extracted from a Bangla voice check-in (or entered via the tap form).
 * `null` means "not mentioned / unknown". The rule engine treats unknown as not-present,
 * and the UI asks follow-up questions for anything listed in `unclearFields`.
 */
export const symptomsSchema = z.object({
  fever: z.boolean().nullable(),
  temperatureF: z.number().nullable(),
  feverJustDropped: z.boolean().nullable(),
  vomitingCount24h: z.number().int().nullable(),
  abdominalPain: z.enum(["none", "mild", "severe"]).nullable(),
  bleedingGums: z.boolean().nullable(),
  bleedingNose: z.boolean().nullable(),
  vomitBlood: z.boolean().nullable(),
  blackStool: z.boolean().nullable(),
  skinSpots: z.boolean().nullable(),
  heavyMenstrualBleeding: z.boolean().nullable(),
  /** Bleeding reported without a site, or from anywhere else (e.g. "রক্তপাত আছে", blood in urine). */
  bleedingOther: z.boolean().nullable().default(null),
  /** No urine for 6 hours or more */
  noUrine6h: z.boolean().nullable(),
  drowsyOrRestless: z.boolean().nullable(),
  coldClammyHands: z.boolean().nullable(),
  canDrinkFluids: z.boolean().nullable(),
  fluidIntakeLitres: z.number().nullable(),
  breathingDifficulty: z.boolean().nullable(),
  dizzyOnStanding: z.boolean().nullable(),
});
export type Symptoms = z.infer<typeof symptomsSchema>;

export const emptySymptoms: Symptoms = {
  fever: null,
  temperatureF: null,
  feverJustDropped: null,
  vomitingCount24h: null,
  abdominalPain: null,
  bleedingGums: null,
  bleedingNose: null,
  vomitBlood: null,
  blackStool: null,
  skinSpots: null,
  heavyMenstrualBleeding: null,
  bleedingOther: null,
  noUrine6h: null,
  drowsyOrRestless: null,
  coldClammyHands: null,
  canDrinkFluids: null,
  fluidIntakeLitres: null,
  breathingDifficulty: null,
  dizzyOnStanding: null,
};

/** One moment of the caregiver's day summary, e.g. { when: "morning", noteBn: "দুইবার বমি" }. */
export const timelineItemSchema = z.object({
  when: z.enum(["morning", "noon", "afternoon", "evening", "night", "now", "unspecified"]),
  noteBn: z.string(),
});
export type TimelineItem = z.infer<typeof timelineItemSchema>;

/** Who the speaker says they are describing; used to catch a message about the wrong patient. */
export const mentionedSchema = z.object({
  name: z.string().nullable(),
  ageYears: z.number().nullable(),
  sex: z.enum(["male", "female"]).nullable(),
  /** relation to the speaker as said, e.g. "ছেলে", "মা" */
  relationBn: z.string().nullable(),
  /** "আজ জ্বরের তিন দিন" -> 3 */
  feverDay: z.number().int().nullable(),
  /** the message describes more than one sick person */
  multiplePatients: z.boolean(),
});
export type Mentioned = z.infer<typeof mentionedSchema>;
export const emptyMentioned: Mentioned = {
  name: null,
  ageYears: null,
  sex: null,
  relationBn: null,
  feverDay: null,
  multiplePatients: false,
};

export const voiceExtractionSchema = z.object({
  transcriptBn: z.string(),
  symptoms: symptomsSchema,
  unclearFields: z.array(z.string()),
  timeline: z.array(timelineItemSchema).default([]),
  mentioned: mentionedSchema.default(emptyMentioned),
});
export type VoiceExtraction = z.infer<typeof voiceExtractionSchema>;

/** Raw values the vision model reads from a CBC photo. Units are normalised in code. */
export const cbcExtractionSchema = z.object({
  isCbcReport: z.boolean(),
  plateletRaw: z.string().nullable(),
  plateletUnit: z.string().nullable(),
  hematocritPct: z.number().nullable(),
  wbcRaw: z.string().nullable(),
  wbcUnit: z.string().nullable(),
  hemoglobinGdl: z.number().nullable(),
  reportDate: z.string().nullable(),
  labName: z.string().nullable(),
  /** Printed patient identity, used to catch another person's report. */
  patientName: z.string().nullable().default(null),
  patientAgeRaw: z.string().nullable().default(null),
  patientSexRaw: z.string().nullable().default(null),
  confidence: z.enum(["high", "low"]),
});
export type CbcExtraction = z.infer<typeof cbcExtractionSchema>;

/** The AI's second opinion on the timeline. It may only raise the rule-based status. */
export const aiRiskSchema = z.object({
  status: z.enum(["GREEN", "YELLOW", "RED"]),
  reasonsBn: z.array(z.string()),
  adviceBn: z.string(),
});
export type AiRisk = z.infer<typeof aiRiskSchema>;
