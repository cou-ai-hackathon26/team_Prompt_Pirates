import "server-only";
import { type Prisma } from "../../../generated/prisma";
import { reviewRisk } from "~/lib/ai/service";
import { symptomsSchema } from "~/lib/ai/schemas";
import { dhakaHour, fluidTargetMl, startOfDhakaDay } from "~/lib/fluids";
import { dhakaDay } from "~/lib/anomaly";
import { mergeDaySymptoms } from "~/lib/risk/merge-day";
import { combine } from "~/lib/risk/score";
import { reportConflicts, symptomsVsLab } from "~/lib/risk/consistency";
import { evaluateRules, maxStatus } from "~/lib/risk/who-rules";
import { db } from "~/server/db";

/** Max time to wait for the optional AI risk review before falling back to rules only. */
const AI_REVIEW_BUDGET_MS = 10_000;

/**
 * Re-run the risk engine for a patient and store a RiskAssessment.
 * Rules always run; the AI review is best-effort (if it fails or is slow, rules + static advice are used).
 */
export async function reassessPatient(
  patientId: string,
  opts: { useAi?: boolean } = {},
) {
  const patient = await db.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: {
      checkIns: { orderBy: { createdAt: "asc" } },
      labs: { where: { confirmed: true }, orderBy: { takenAt: "asc" } },
    },
  });

  const now = new Date();
  const latest = patient.checkIns.at(-1);
  // The day's picture = worst of every check-in on the latest check-in's (Dhaka) day, so a second
  // message ("এখন ভালো আছে") cannot erase a danger sign reported earlier the same day.
  const today = latest
    ? patient.checkIns.filter((c) => dhakaDay(c.createdAt) === dhakaDay(latest.createdAt))
    : [];
  const fluidLogs = await db.fluidLog.findMany({
    where: { patientId, createdAt: { gte: startOfDhakaDay(now) } },
    select: { ml: true },
  });
  const fluidsTodayMl = fluidLogs.reduce((s, l) => s + l.ml, 0);
  const fluidTarget = fluidTargetMl(patient.ageYears, patient.weightKg).ml;
  const daySymptoms = latest
    ? mergeDaySymptoms(today.map((c) => symptomsSchema.parse(c.symptoms)))
    : null;
  const ruleInput = {
    patient,
    latestCheckIn: latest && daySymptoms ? { createdAt: latest.createdAt, symptoms: daySymptoms } : null,
    labs: patient.labs,
    now,
    fluids: {
      todayMl: fluidsTodayMl,
      targetMl: fluidTarget,
      logged: fluidLogs.length > 0,
      localHour: dhakaHour(now),
    },
  };
  let rule = evaluateRules(ruleInput);

  // ---- Contradictions (src/lib/risk/consistency.ts): never lower risk on doubtful data, and
  // treat contradictory data itself as a reason to see a doctor (at least YELLOW).
  const latestLab = patient.labs.at(-1) ?? null;
  const clinical = [];
  if (latestLab) {
    const jump = reportConflicts({
      lab: latestLab,
      previous: patient.labs.slice(0, -1),
      feverStart: patient.feverStart,
      now,
    }).filter((c) => c.code === "LAB_JUMP");
    if (jump.length > 0) {
      // A suspiciously good report may not lower the status: also judge without it, keep the worse.
      const without = evaluateRules({ ...ruleInput, labs: patient.labs.slice(0, -1) });
      if (maxStatus(without.status, rule.status) !== rule.status) rule = without;
      clinical.push(...jump);
    }
  }
  const vsLab = symptomsVsLab(daySymptoms, latestLab, startOfDhakaDay(now));
  if (vsLab) clinical.push(vsLab);
  if (clinical.length > 0) {
    rule = {
      ...rule,
      status: maxStatus(rule.status, "YELLOW"),
      reasons: [
        ...rule.reasons,
        ...clinical.map((c) => ({
          source: "rule" as const,
          code: "DATA_CONFLICT",
          textBn: c.textBn,
          level: "YELLOW" as const,
        })),
      ],
    };
  }

  let ai = null;
  if (opts.useAi !== false) {
    const timeline = {
      ageYears: patient.ageYears,
      riskFactors: patient.riskFactors,
      dayOfFever: rule.dayOfFever,
      oralFluidsTodayMl: fluidLogs.length ? fluidsTodayMl : null,
      oralFluidTargetMl: fluidTarget,
      checkIns: patient.checkIns.slice(-7).map((c) => ({
        at: c.createdAt.toISOString(),
        symptoms: c.symptoms,
      })),
      labs: patient.labs.map((l) => ({
        at: l.takenAt.toISOString(),
        plateletUl: l.plateletUl,
        hctPct: l.hctPct,
        wbcUl: l.wbcUl,
      })),
    };
    // The AI review is a best-effort second opinion (rules already decided the minimum status),
    // so never let a slow free-tier model hold the family's result hostage: give it AI_REVIEW_BUDGET_MS.
    try {
      const review = reviewRisk(timeline, {
        status: rule.status,
        reasons: rule.reasons,
      });
      review.catch(() => undefined); // if we time out, a late rejection must not crash the process
      ai = (
        await Promise.race([
          review,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`AI review exceeded ${AI_REVIEW_BUDGET_MS} ms`),
                ),
              AI_REVIEW_BUDGET_MS,
            ),
          ),
        ])
      ).value;
    } catch (err) {
      console.warn(
        "[assess] AI review skipped, using rules + standard advice:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const final = combine(rule, ai);
  const saved = await db.riskAssessment.create({
    data: {
      patientId,
      status: final.status,
      ruleStatus: final.ruleStatus,
      aiStatus: final.aiStatus,
      reasons: final.reasons as unknown as Prisma.InputJsonValue,
      adviceBn: final.adviceBn,
    },
  });
  return {
    ...saved,
    reasons: final.reasons,
    dayOfFever: rule.dayOfFever,
    inCriticalPhase: rule.inCriticalPhase,
  };
}
