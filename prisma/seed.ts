/**
 * Seeds SYNTHETIC data (isSynthetic = true). Real patients are never touched.
 *
 *   pnpm db:seed        all synthetic patients for the dashboard + the demo patient
 *   pnpm demo:reset     only re-create the demo patient (run right before presenting)
 *
 * Dates are relative to "now", so re-run the seed on the day of the demo.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "../generated/prisma";
import { emptySymptoms, type Symptoms } from "../src/lib/ai/schemas";
import { FALLBACK_ADVICE_BN } from "../src/lib/risk/advice";
import { evaluateRules, type RuleLab } from "../src/lib/risk/who-rules";
import { startOfDhakaDay } from "../src/lib/fluids";

const db = new PrismaClient();
const DAY = 864e5;
const now = new Date();

export const DEMO_PATIENT_ID = "demo-rahim";

/* -------- deterministic random so every seed looks the same -------- */
let s = 20261122;
const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);

const NAMES = [
  "রহিম",
  "করিম",
  "সুমাইয়া",
  "নুসরাত",
  "জামাল",
  "ফাতেমা",
  "তানভীর",
  "আয়েশা",
  "রফিক",
  "মিম",
  "সাকিব",
  "রুমানা",
  "হাসান",
  "তাসলিমা",
  "আরিফ",
  "শাহানা",
];

/** Area weights: Dhaka areas busier; Sonapur gets a planted outbreak in the last 3 days. */
const AREA_WEIGHT: Record<string, number> = {
  "noakhali.noakhali-sadar": 1.2,
  "noakhali.sonapur": 0.8,
  "noakhali.begumganj": 0.9,
  "noakhali.companiganj": 0.5,
  "dhaka.mirpur": 1.6,
  "dhaka.uttara-west": 1.2,
  "dhaka.jatrabari": 1.5,
  "dhaka.mohammadpur": 1.3,
  "chattogram.kotwali": 1.1,
  "cumilla.cumilla-sadar": 0.8,
  // A light nationwide spread so the district view has something outside the demo region.
  "gazipur.gazipur-sadar": 0.7,
  "narayanganj.narayanganj-sadar": 0.6,
  "barishal.barisal-sadar": 0.6,
  "sylhet.sylhet-sadar": 0.4,
  "mymensingh.mymensingh-sadar": 0.4,
  "rangpur.rangpur-sadar": 0.3,
  "feni.feni-sadar": 0.4,
};
const SPIKE_AREA = "noakhali.sonapur";

interface Rows {
  patients: Prisma.PatientCreateManyInput[];
  checkIns: Prisma.CheckInCreateManyInput[];
  labs: Prisma.LabResultCreateManyInput[];
  assessments: Prisma.RiskAssessmentCreateManyInput[];
}

/** Simulate one patient's course from fever day 1 up to today (or recovery / admission). */
function simulatePatient(
  rows: Rows,
  area: string,
  feverStart: Date,
  severe: boolean,
) {
  const id = randomUUID();
  const age = chance(0.25)
    ? Math.floor(between(1, 14))
    : Math.floor(between(15, 75));
  const riskFactors = chance(0.12)
    ? [pick(["diabetes", "pregnant", "kidney", "heart"])]
    : [];
  rows.patients.push({
    id,
    nickname: pick(NAMES),
    ageYears: age,
    area,
    feverStart,
    riskFactors,
    isSynthetic: true,
    createdAt: feverStart,
  });

  const baseHct = between(36, 42);
  const labs: RuleLab[] = [];
  const lastDay = Math.min(
    8,
    Math.floor((now.getTime() - feverStart.getTime()) / DAY) + 1,
  );

  for (let day = 1; day <= lastDay; day++) {
    const at = new Date(
      feverStart.getTime() + (day - 1) * DAY + between(2, 10) * 3600e3,
    );
    if (at > now) break;
    const critical = day >= 3 && day <= 6;
    const worsening = severe && critical;

    const symptoms: Symptoms = {
      ...emptySymptoms,
      fever: day <= 3,
      feverJustDropped:
        (day === 4 && chance(0.45)) || (day === 3 && chance(0.15)),
      canDrinkFluids: !(worsening && chance(0.3)),
      abdominalPain: worsening
        ? pick(["mild", "severe"] as const)
        : chance(0.1)
          ? "mild"
          : "none",
      vomitingCount24h: worsening
        ? Math.floor(between(1, 5))
        : chance(0.1)
          ? 1
          : 0,
      bleedingGums: worsening && chance(0.2),
      drowsyOrRestless: worsening && day >= 4 && chance(0.25),
      skinSpots: day >= 3 && chance(0.08),
    };
    rows.checkIns.push({
      id: randomUUID(),
      patientId: id,
      createdAt: at,
      source: chance(0.7) ? "VOICE" : "FORM",
      symptoms,
    });

    if (day === 2 || day === 4 || (severe && day === 5)) {
      const plt = worsening
        ? Math.round(between(25, 95)) * 1000
        : Math.round(between(110, 260)) * 1000;
      const hct = worsening
        ? baseHct * between(1.1, 1.25)
        : baseHct * between(0.97, 1.06);
      const lab = {
        takenAt: at,
        plateletUl: plt,
        hctPct: Math.round(hct * 10) / 10,
      };
      labs.push(lab);
      rows.labs.push({
        id: randomUUID(),
        patientId: id,
        ...lab,
        wbcUl: Math.round(between(2.5, 7)) * 1000,
        confirmed: true,
        createdAt: at,
      });
    }

    const rule = evaluateRules({
      patient: { ageYears: age, riskFactors, feverStart },
      latestCheckIn: { createdAt: at, symptoms },
      labs,
      now: at,
    });
    rows.assessments.push({
      id: randomUUID(),
      patientId: id,
      createdAt: at,
      status: rule.status,
      ruleStatus: rule.status,
      aiStatus: null,
      reasons: rule.reasons as unknown as Prisma.InputJsonValue,
      adviceBn: FALLBACK_ADVICE_BN[rule.status],
    });
    if (rule.status === "RED") break; // admitted to hospital: stops home monitoring
  }
}

async function insert(rows: Rows) {
  const chunk = <T>(xs: T[], n = 500) =>
    Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
      xs.slice(i * n, i * n + n),
    );
  for (const c of chunk(rows.patients))
    await db.patient.createMany({ data: c });
  for (const c of chunk(rows.checkIns))
    await db.checkIn.createMany({ data: c });
  for (const c of chunk(rows.labs)) await db.labResult.createMany({ data: c });
  for (const c of chunk(rows.assessments))
    await db.riskAssessment.createMany({ data: c });
}

async function seedPopulation() {
  await db.patient.deleteMany({
    where: { isSynthetic: true, NOT: { id: DEMO_PATIENT_ID } },
  });
  const rows: Rows = { patients: [], checkIns: [], labs: [], assessments: [] };
  for (let d = 21; d >= 0; d--) {
    for (const [areaId, weight] of Object.entries(AREA_WEIGHT)) {
      const area = { id: areaId };
      // Outbreak cluster: fever onsets ~2 days ago, so those patients enter the critical phase (day 3) today.
      const spike = area.id === SPIKE_AREA && d === 2;
      const expected = weight * (spike ? 9 : 1.1);
      const n = Math.floor(expected + rand());
      for (let i = 0; i < n; i++) {
        const feverStart = new Date(
          now.getTime() - d * DAY - between(0, 20) * 3600e3,
        );
        simulatePatient(
          rows,
          area.id,
          feverStart,
          spike ? chance(0.7) : chance(0.18),
        );
      }
    }
  }
  await insert(rows);
  console.log(
    `✓ ${rows.patients.length} synthetic patients, ${rows.checkIns.length} check-ins, ${rows.labs.length} lab results, ${rows.assessments.length} assessments`,
  );
}

/**
 * Demo patient "রহিম (ডেমো)", 9 years, Sonapur. Fever started 3.4 days ago (so today = day 4).
 * History: day 1-3 check-ins GREEN, day 2 CBC normal (matches sample report demo-day2-shapla).
 * During the live demo you add the day-4 voice check-in and the day-4 CBC photo -> RED.
 */
async function seedDemoPatient() {
  await db.patient.deleteMany({ where: { id: DEMO_PATIENT_ID } });
  const feverStart = new Date(now.getTime() - 3.4 * DAY);
  const at = (day: number, hour: number) =>
    new Date(feverStart.getTime() + (day - 1) * DAY + hour * 3600e3);
  const patient = { ageYears: 9, riskFactors: [] as string[], feverStart };
  await db.patient.create({
    data: {
      id: DEMO_PATIENT_ID,
      nickname: "রহিম (ডেমো)",
      sex: "male",
      weightKg: 27,
      area: "noakhali.sonapur",
      isSynthetic: true,
      ...patient,
      createdAt: feverStart,
    },
  });

  const days: [number, Partial<Symptoms>, string][] = [
    [
      1,
      {
        fever: true,
        temperatureF: 102,
        canDrinkFluids: true,
        fluidIntakeLitres: 1.5,
      },
      "গতকাল রাত থেকে জ্বর, ১০২ ডিগ্রি। পানি খাচ্ছে।",
    ],
    [
      2,
      {
        fever: true,
        temperatureF: 103,
        canDrinkFluids: true,
        abdominalPain: "none",
        vomitingCount24h: 0,
      },
      "জ্বর ১০৩, শরীর ব্যথা, বমি নেই, পেটে ব্যথা নেই।",
    ],
    [
      3,
      {
        fever: true,
        temperatureF: 101,
        canDrinkFluids: true,
        skinSpots: false,
        vomitingCount24h: 0,
      },
      "জ্বর একটু কম, ১০১। খাওয়া দাওয়া কম কিন্তু পানি খাচ্ছে।",
    ],
  ];
  const labs: RuleLab[] = [];
  for (const [day, partial, transcript] of days) {
    const t = at(day, 4);
    const symptoms = { ...emptySymptoms, ...partial };
    await db.checkIn.create({
      data: {
        patientId: DEMO_PATIENT_ID,
        createdAt: t,
        source: "VOICE",
        transcript,
        symptoms,
      },
    });
    if (day === 2) {
      const lab = { takenAt: at(2, 6), plateletUl: 160_000, hctPct: 38 };
      labs.push(lab);
      await db.labResult.create({
        data: {
          patientId: DEMO_PATIENT_ID,
          ...lab,
          wbcUl: 4200,
          hbGdl: 12.8,
          confirmed: true,
          createdAt: lab.takenAt,
        },
      });
    }
    const rule = evaluateRules({
      patient,
      latestCheckIn: { createdAt: t, symptoms },
      labs,
      now: t,
    });
    await db.riskAssessment.create({
      data: {
        patientId: DEMO_PATIENT_ID,
        createdAt: day === 2 ? at(2, 6) : t,
        status: rule.status,
        ruleStatus: rule.status,
        reasons: rule.reasons as unknown as Prisma.InputJsonValue,
        adviceBn: FALLBACK_ADVICE_BN[rule.status],
      },
    });
  }
  // "N hours ago", but never before the start of today in Dhaka (so the tracker shows them at any hour)
  const todayAt = (hoursAgo: number) =>
    new Date(
      Math.max(
        now.getTime() - hoursAgo * 3600e3,
        startOfDhakaDay(now).getTime() + (4 - hoursAgo) * 60e3,
      ),
    );
  // Fluid history: below target (1,650 ml for 27 kg) on days 1-3, and two glasses so far today.
  const fluids: { day: number; hour: number; ml: number; kind: string }[] = [
    ...[1, 2, 3].flatMap((day) => [
      { day, hour: 2, ml: 200, kind: "water" },
      { day, hour: 5, ml: 500, kind: "ors" },
      { day, hour: 8, ml: 200, kind: "water" },
      { day, hour: 11, ml: day === 3 ? 100 : 300, kind: "water" },
    ]),
  ];
  await db.fluidLog.createMany({
    data: [
      ...fluids.map((f) => ({
        patientId: DEMO_PATIENT_ID,
        ml: f.ml,
        kind: f.kind,
        createdAt: at(f.day, f.hour),
      })),
      // "today" entries relative to now so the tracker shows progress on stage
      {
        patientId: DEMO_PATIENT_ID,
        ml: 200,
        kind: "water",
        createdAt: todayAt(3),
      },
      {
        patientId: DEMO_PATIENT_ID,
        ml: 200,
        kind: "water",
        createdAt: todayAt(1),
      },
    ].filter((f) => f.createdAt <= now),
  });
  console.log(`✓ demo patient ready: /p/${DEMO_PATIENT_ID}`);
}

const onlyDemo = process.argv.includes("--demo-only");
if (!onlyDemo) await seedPopulation();
await seedDemoPatient();
await db.$disconnect();
