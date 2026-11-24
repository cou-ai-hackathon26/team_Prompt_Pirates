import type { Symptoms } from "~/lib/ai/schemas";
import { toBn } from "../bn";
import { HIGH_RISK_FACTORS, THRESHOLDS as T } from "./thresholds";

export type Status = "GREEN" | "YELLOW" | "RED";

export interface Reason {
  source: "rule" | "ai";
  code: string;
  textBn: string;
  level: Status;
}

export interface RulePatient {
  ageYears: number;
  riskFactors: string[];
  feverStart: Date;
}

export interface RuleCheckIn {
  createdAt: Date;
  symptoms: Symptoms;
}

export interface RuleLab {
  takenAt: Date;
  plateletUl: number | null;
  hctPct: number | null;
}

export interface RuleInput {
  patient: RulePatient;
  /** Most recent check-in, if any */
  latestCheckIn: RuleCheckIn | null;
  /** All lab results, any order */
  labs: RuleLab[];
  now: Date;
  /** Oral fluids logged today (optional; only judged if the family logged something). */
  fluids?: {
    todayMl: number;
    targetMl: number;
    logged: boolean;
    localHour: number;
  };
}

export interface RuleResult {
  status: Status;
  dayOfFever: number;
  inCriticalPhase: boolean;
  hctRisePct: number | null;
  plateletTrend: "falling" | "rising" | "stable" | null;
  reasons: Reason[];
}

const RANK: Record<Status, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

export function maxStatus(...statuses: (Status | null | undefined)[]): Status {
  return statuses.reduce<Status>(
    (acc, s) => (s && RANK[s] > RANK[acc] ? s : acc),
    "GREEN",
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day 1 = the calendar span of the first 24 h after fever started. */
export function dayOfFever(feverStart: Date, now: Date): number {
  return Math.max(
    1,
    Math.floor((now.getTime() - feverStart.getTime()) / DAY_MS) + 1,
  );
}

/**
 * Hard-coded WHO 2009 warning-sign rules. Pure function, no AI, fully unit tested.
 * The AI layer (score.ts) can only raise the status this returns, never lower it.
 */
export function evaluateRules(input: RuleInput): RuleResult {
  const { patient, latestCheckIn, now } = input;
  const reasons: Reason[] = [];
  const add = (level: Status, code: string, textBn: string) =>
    reasons.push({ source: "rule", code, textBn, level });

  const day = dayOfFever(patient.feverStart, now);
  const critical =
    day >= T.criticalPhaseStartDay && day <= T.criticalPhaseEndDay;

  // ---------- Symptoms (latest check-in) ----------
  const s = latestCheckIn?.symptoms;
  if (s) {
    // RED: WHO warning signs
    if (s.abdominalPain === "severe")
      add("RED", "SEVERE_ABDOMINAL_PAIN", "পেটে তীব্র ব্যথা");
    if ((s.vomitingCount24h ?? 0) >= T.persistentVomitingCount)
      add("RED", "PERSISTENT_VOMITING", "২৪ ঘণ্টায় ৩ বা তার বেশি বার বমি");
    if (s.vomitBlood) add("RED", "VOMIT_BLOOD", "বমির সাথে রক্ত");
    if (s.blackStool) add("RED", "BLACK_STOOL", "কালো পায়খানা");
    if (s.bleedingOther)
      add(
        "RED",
        "ANY_BLEEDING",
        "রক্তপাতের কথা বলা হয়েছে (কোথা থেকে, ডাক্তারকে জানান)",
      );
    if (s.bleedingGums || s.bleedingNose || s.heavyMenstrualBleeding)
      add(
        "RED",
        "MUCOSAL_BLEEDING",
        "দাঁতের মাড়ি, নাক বা অতিরিক্ত মাসিকের রক্তপাত",
      );
    if (s.drowsyOrRestless)
      add("RED", "LETHARGY_RESTLESSNESS", "অতিরিক্ত ঘুম ঘুম ভাব বা অস্থিরতা");
    if (s.coldClammyHands)
      add("RED", "COLD_CLAMMY", "হাত-পা ঠান্ডা ও ভেজা ভেজা");
    if (s.noUrine6h)
      add("RED", "NO_URINE_6H", "৬ ঘণ্টা বা বেশি সময় প্রস্রাব হয়নি");
    if (s.canDrinkFluids === false)
      add("RED", "CANNOT_DRINK", "মুখে পানি বা তরল খেতে পারছে না");
    if (s.breathingDifficulty) add("RED", "BREATHING", "শ্বাসকষ্ট");

    // YELLOW: early or softer signs, mostly relevant in the critical phase
    if (s.abdominalPain === "mild")
      add("YELLOW", "MILD_ABDOMINAL_PAIN", "পেটে হালকা ব্যথা");
    const v = s.vomitingCount24h ?? 0;
    if (v > 0 && v < T.persistentVomitingCount)
      add("YELLOW", "SOME_VOMITING", "বমি হয়েছে");
    if (s.skinSpots) add("YELLOW", "SKIN_SPOTS", "চামড়ায় লাল ছোপ বা দাগ");
    if (s.dizzyOnStanding) add("YELLOW", "DIZZY", "দাঁড়ালে মাথা ঘোরে");
    if (s.feverJustDropped && critical)
      add(
        "YELLOW",
        "FEVER_DROP_CRITICAL",
        "জ্বর কমেছে, কিন্তু এখনই সবচেয়ে ঝুঁকির সময় (৩য়-৭ম দিন)",
      );
  }

  // ---------- Low oral fluids in the critical phase (only if the family is logging) ----------
  const f = input.fluids;
  if (
    critical &&
    f?.logged &&
    f.localHour >= T.fluids.checkAfterHour &&
    f.todayMl < f.targetMl * T.fluids.lowFraction
  )
    add(
      "YELLOW",
      "LOW_FLUIDS",
      `আজ লক্ষ্যের অর্ধেকের কম তরল খেয়েছে (${toBn(f.todayMl)} / ${toBn(f.targetMl)} মিলি)`,
    );

  // ---------- Missed check-in during critical phase ----------
  if (critical) {
    const last = latestCheckIn?.createdAt;
    const hours = last ? (now.getTime() - last.getTime()) / 36e5 : Infinity;
    if (hours > T.missedCheckInHours)
      add("YELLOW", "MISSED_CHECKIN", "ঝুঁকির সময়ে ২৪ ঘণ্টার বেশি কোনো আপডেট নেই");
  }

  // ---------- Labs ----------
  const labs = [...input.labs].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
  );
  const plts = labs
    .filter((l) => l.plateletUl != null)
    .map((l) => l.plateletUl!);
  const hcts = labs.filter((l) => l.hctPct != null).map((l) => l.hctPct!);

  let plateletTrend: RuleResult["plateletTrend"] = null;
  if (plts.length >= 2) {
    const [prev, last] = plts.slice(-2) as [number, number];
    const change = (last - prev) / prev;
    plateletTrend =
      change < -0.1 ? "falling" : change > 0.1 ? "rising" : "stable";
  }

  const latestPlt = plts.at(-1);
  if (latestPlt != null) {
    if (latestPlt < T.plateletRed)
      add(
        "RED",
        "PLATELET_VERY_LOW",
        `প্লাটিলেট খুব কম (${toBn(latestPlt.toLocaleString("en-IN"))})`,
      );
    else if (latestPlt <= T.plateletYellow)
      add(
        "YELLOW",
        "PLATELET_LOW",
        `প্লাটিলেট কম (${toBn(latestPlt.toLocaleString("en-IN"))})`,
      );
  }

  let hctRisePct: number | null = null;
  if (hcts.length >= 2) {
    const baseline = hcts[0]!;
    const latest = hcts.at(-1)!;
    hctRisePct = ((latest - baseline) / baseline) * 100;
    if (hctRisePct >= T.hctRiseRedPct)
      add(
        "RED",
        "HCT_RISE_HIGH",
        `হেমাটোক্রিট শুরুর তুলনায় ${toBn(Math.round(hctRisePct))}% বেড়েছে (রক্তনালী থেকে তরল বের হওয়ার লক্ষণ)`,
      );
    else if (hctRisePct >= T.hctRiseYellowPct) {
      // WHO lab warning sign: rising HCT together with rapidly falling platelets
      if (plateletTrend === "falling")
        add("RED", "HCT_UP_PLT_DOWN", "হেমাটোক্রিট বাড়ছে আর প্লাটিলেট দ্রুত কমছে");
      else
        add(
          "YELLOW",
          "HCT_RISE",
          `হেমাটোক্রিট ${toBn(Math.round(hctRisePct))}% বেড়েছে`,
        );
    }
  }

  // ---------- Patient risk factors (WHO group B: co-existing conditions) ----------
  const highRisk = patient.riskFactors.filter((f) =>
    (HIGH_RISK_FACTORS as readonly string[]).includes(f),
  );
  if (patient.ageYears < T.infantMaxAgeYears) highRisk.push("infant");
  if (patient.ageYears >= T.elderlyMinAgeYears) highRisk.push("elderly");
  if (highRisk.length > 0)
    add(
      "YELLOW",
      "HIGH_RISK_PATIENT",
      "ঝুঁকিপূর্ণ রোগী (শিশু, বয়স্ক, গর্ভবতী বা দীর্ঘমেয়াদি রোগ): আজই ডাক্তার দেখান",
    );

  return {
    status: maxStatus(...reasons.map((r) => r.level)),
    dayOfFever: day,
    inCriticalPhase: critical,
    hctRisePct,
    plateletTrend,
    reasons,
  };
}
