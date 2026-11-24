import { describe, expect, it } from "vitest";
import { emptySymptoms, type Symptoms } from "~/lib/ai/schemas";
import { combine } from "../score";
import { dayOfFever, evaluateRules, type RuleInput, type RuleLab } from "../who-rules";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-21T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);

function input(opts: {
  feverDay?: number;
  symptoms?: Partial<Symptoms>;
  checkInHoursAgo?: number | null;
  labs?: RuleLab[];
  age?: number;
  riskFactors?: string[];
}): RuleInput {
  const feverDay = opts.feverDay ?? 2;
  return {
    patient: {
      ageYears: opts.age ?? 25,
      riskFactors: opts.riskFactors ?? [],
      feverStart: daysAgo(feverDay - 1 + 0.1),
    },
    latestCheckIn:
      opts.checkInHoursAgo === null
        ? null
        : {
            createdAt: new Date(now.getTime() - (opts.checkInHoursAgo ?? 1) * 36e5),
            symptoms: { ...emptySymptoms, ...opts.symptoms },
          },
    labs: opts.labs ?? [],
    now,
  };
}

const codes = (r: ReturnType<typeof evaluateRules>) => r.reasons.map((x) => x.code);

describe("dayOfFever", () => {
  it("is 1 on the first day", () => expect(dayOfFever(now, now)).toBe(1));
  it("counts whole days", () => expect(dayOfFever(daysAgo(3.5), now)).toBe(4));
});

describe("GREEN", () => {
  it("healthy-looking day 2 patient with fever only", () => {
    const r = evaluateRules(input({ symptoms: { fever: true, canDrinkFluids: true } }));
    expect(r.status).toBe("GREEN");
    expect(r.reasons).toHaveLength(0);
  });
});

describe("RED warning signs", () => {
  it.each<[Partial<Symptoms>, string]>([
    [{ abdominalPain: "severe" }, "SEVERE_ABDOMINAL_PAIN"],
    [{ vomitingCount24h: 3 }, "PERSISTENT_VOMITING"],
    [{ vomitBlood: true }, "VOMIT_BLOOD"],
    [{ blackStool: true }, "BLACK_STOOL"],
    [{ bleedingGums: true }, "MUCOSAL_BLEEDING"],
    [{ bleedingNose: true }, "MUCOSAL_BLEEDING"],
    [{ drowsyOrRestless: true }, "LETHARGY_RESTLESSNESS"],
    [{ coldClammyHands: true }, "COLD_CLAMMY"],
    [{ noUrine6h: true }, "NO_URINE_6H"],
    [{ canDrinkFluids: false }, "CANNOT_DRINK"],
    [{ breathingDifficulty: true }, "BREATHING"],
  ])("%o -> RED (%s)", (symptoms, code) => {
    const r = evaluateRules(input({ symptoms }));
    expect(r.status).toBe("RED");
    expect(codes(r)).toContain(code);
  });

  it("platelets below 50,000 -> RED", () => {
    const r = evaluateRules(input({ labs: [{ takenAt: daysAgo(0), plateletUl: 45_000, hctPct: null }] }));
    expect(r.status).toBe("RED");
    expect(codes(r)).toContain("PLATELET_VERY_LOW");
  });

  it("HCT rise >= 20% from baseline -> RED", () => {
    const r = evaluateRules(
      input({
        labs: [
          { takenAt: daysAgo(2), plateletUl: 180_000, hctPct: 40 },
          { takenAt: daysAgo(0), plateletUl: 170_000, hctPct: 48 },
        ],
      }),
    );
    expect(r.hctRisePct).toBeCloseTo(20);
    expect(codes(r)).toContain("HCT_RISE_HIGH");
    expect(r.status).toBe("RED");
  });

  it("HCT rising 10-20% with rapidly falling platelets -> RED (WHO lab warning sign)", () => {
    const r = evaluateRules(
      input({
        labs: [
          { takenAt: daysAgo(1), plateletUl: 140_000, hctPct: 40 },
          { takenAt: daysAgo(0), plateletUl: 90_000, hctPct: 45 },
        ],
      }),
    );
    expect(r.plateletTrend).toBe("falling");
    expect(codes(r)).toContain("HCT_UP_PLT_DOWN");
    expect(r.status).toBe("RED");
  });

  it("demo scenario: day 4, fever dropped, belly pain and vomiting twice, plt 45k -> RED", () => {
    const r = evaluateRules(
      input({
        feverDay: 4,
        symptoms: { feverJustDropped: true, abdominalPain: "mild", vomitingCount24h: 2 },
        labs: [
          { takenAt: daysAgo(2), plateletUl: 160_000, hctPct: 38 },
          { takenAt: daysAgo(0), plateletUl: 45_000, hctPct: 46 },
        ],
      }),
    );
    expect(r.inCriticalPhase).toBe(true);
    expect(r.status).toBe("RED");
  });
});

describe("YELLOW", () => {
  it("fever dropped during critical phase -> YELLOW", () => {
    const r = evaluateRules(input({ feverDay: 4, symptoms: { feverJustDropped: true } }));
    expect(r.status).toBe("YELLOW");
    expect(codes(r)).toContain("FEVER_DROP_CRITICAL");
  });

  it("fever dropped on day 2 is not flagged", () => {
    const r = evaluateRules(input({ feverDay: 2, symptoms: { feverJustDropped: true } }));
    expect(r.status).toBe("GREEN");
  });

  it("platelets 50k-100k -> YELLOW", () => {
    const r = evaluateRules(input({ labs: [{ takenAt: daysAgo(0), plateletUl: 85_000, hctPct: null }] }));
    expect(r.status).toBe("YELLOW");
  });

  it("vomiting 1-2 times -> YELLOW", () => {
    expect(evaluateRules(input({ symptoms: { vomitingCount24h: 2 } })).status).toBe("YELLOW");
  });

  it("no check-in for > 24 h during critical phase -> YELLOW", () => {
    const r = evaluateRules(input({ feverDay: 5, checkInHoursAgo: 30 }));
    expect(codes(r)).toContain("MISSED_CHECKIN");
    expect(r.status).toBe("YELLOW");
  });

  it("no check-in ever during critical phase -> YELLOW", () => {
    expect(evaluateRules(input({ feverDay: 3, checkInHoursAgo: null })).status).toBe("YELLOW");
  });

  it.each([
    [{ age: 0 }],
    [{ age: 70 }],
    [{ riskFactors: ["pregnant"] }],
    [{ riskFactors: ["diabetes"] }],
  ])("high-risk patient %o -> at least YELLOW", (p) => {
    const r = evaluateRules(input(p));
    expect(codes(r)).toContain("HIGH_RISK_PATIENT");
    expect(r.status).toBe("YELLOW");
  });

  it("unknown risk factor strings are ignored", () => {
    expect(evaluateRules(input({ riskFactors: ["something"] })).status).toBe("GREEN");
  });
});

describe("combine (rules + AI)", () => {
  const green = evaluateRules(input({}));
  const red = evaluateRules(input({ symptoms: { abdominalPain: "severe" } }));

  it("AI can raise GREEN to YELLOW and its reasons are added", () => {
    const f = combine(green, { status: "YELLOW", reasonsBn: ["প্লাটিলেট ধীরে ধীরে কমছে"], adviceBn: "আজই ডাক্তার দেখান।" });
    expect(f.status).toBe("YELLOW");
    expect(f.reasons.some((r) => r.source === "ai")).toBe(true);
    expect(f.adviceBn).toBe("আজই ডাক্তার দেখান।");
  });

  it("AI can never lower RED", () => {
    const f = combine(red, { status: "GREEN", reasonsBn: [], adviceBn: "সব ঠিক আছে" });
    expect(f.status).toBe("RED");
    expect(f.aiStatus).toBe("GREEN");
    // disagreeing AI advice is not shown
    expect(f.adviceBn).not.toBe("সব ঠিক আছে");
  });

  it("AI failure falls back to rules and static advice", () => {
    const f = combine(red, null);
    expect(f.status).toBe("RED");
    expect(f.aiStatus).toBeNull();
    expect(f.adviceBn.length).toBeGreaterThan(10);
  });
});

describe("bleeding without a stated site", () => {
  it("bleedingOther -> RED (ANY_BLEEDING)", () => {
    const r = evaluateRules(input({ symptoms: { bleedingOther: true } }));
    expect(r.status).toBe("RED");
    expect(codes(r)).toContain("ANY_BLEEDING");
  });

  it("check-ins saved before the field existed still parse (defaults to null)", async () => {
    const { symptomsSchema } = await import("~/lib/ai/schemas");
    const old: Record<string, unknown> = { ...emptySymptoms, fever: true };
    delete old.bleedingOther;
    const parsed = symptomsSchema.parse(old);
    expect(parsed.bleedingOther).toBeNull();
    expect(parsed.fever).toBe(true);
  });
});
