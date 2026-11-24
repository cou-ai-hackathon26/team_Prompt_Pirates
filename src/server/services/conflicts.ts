import "server-only";
import type { Symptoms } from "~/lib/ai/schemas";
import type { Conflict } from "~/lib/risk/consistency";
import { evaluateRules, type Status } from "~/lib/risk/who-rules";
import { db } from "~/server/db";

/** What the family answered when asked "is this really <patient>?". */
export const identityAnswer = ["same", "other"] as const;
export type IdentityAnswer = (typeof identityAnswer)[number];

/**
 * How dangerous the held data is on its own, so a "no, it's someone else" answer can still tell the
 * family to take THAT person to hospital. Uses the same WHO rules, with neutral patient details.
 */
export function standaloneStatus(input: {
  symptoms?: Symptoms;
  lab?: { plateletUl: number | null; hctPct: number | null };
  ageYears: number;
  feverStart: Date;
}): Status {
  const now = new Date();
  return evaluateRules({
    patient: { ageYears: input.ageYears, riskFactors: [], feverStart: input.feverStart },
    latestCheckIn: input.symptoms ? { createdAt: now, symptoms: input.symptoms } : null,
    labs: input.lab ? [{ takenAt: now, ...input.lab }] : [],
    now,
  }).status;
}

export async function recordConflicts(
  patientId: string,
  source: "VOICE" | "CBC",
  conflicts: Conflict[],
  resolution: "CONFIRMED_SAME" | "REJECTED_OTHER" | "NOTED",
) {
  if (conflicts.length === 0) return;
  await db.dataConflict.createMany({
    data: conflicts.map((c) => ({
      patientId,
      source,
      code: c.code,
      textBn: c.textBn,
      textEn: c.textEn,
      resolution,
    })),
  });
}
