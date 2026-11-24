import { describe, expect, it } from "vitest";
import { emptySymptoms } from "~/lib/ai/schemas";
import { evaluateRules } from "~/lib/risk/who-rules";
import {
  dhakaHour,
  estimateWeightKg,
  fluidTargetMl,
  startOfDhakaDay,
} from "../fluids";

describe("fluidTargetMl", () => {
  it("adults get the fixed adult target", () => {
    expect(fluidTargetMl(30, 60)).toEqual({ ml: 2500, estimatedWeight: false });
  });

  it.each([
    [5, 8, 800], // 8 kg -> 100 ml/kg
    [5, 15, 1250], // 1000 + 5*50
    [9, 27, 1650], // 1000 + 500 + 7*20 = 1640 -> 1650
  ])("child age %i, %i kg -> %i ml (Holliday-Segar)", (age, kg, ml) => {
    expect(fluidTargetMl(age, kg).ml).toBe(ml);
  });

  it("estimates weight from age when unknown", () => {
    expect(estimateWeightKg(6)).toBe(20);
    expect(fluidTargetMl(6, null)).toEqual({ ml: 1500, estimatedWeight: true });
  });

  it("never exceeds the adult target", () => {
    expect(fluidTargetMl(14, 70).ml).toBe(2500);
  });
});

describe("Dhaka day helpers", () => {
  it("start of day is 18:00 UTC of the previous date", () => {
    expect(
      startOfDhakaDay(new Date("2026-11-24T03:00:00Z")).toISOString(),
    ).toBe("2026-11-23T18:00:00.000Z");
    expect(
      startOfDhakaDay(new Date("2026-11-23T19:00:00Z")).toISOString(),
    ).toBe("2026-11-23T18:00:00.000Z");
  });
  it("local hour is UTC+6", () => {
    expect(dhakaHour(new Date("2026-11-24T13:30:00Z"))).toBe(19);
  });
});

describe("LOW_FLUIDS rule", () => {
  const now = new Date("2026-11-24T13:00:00Z");
  const base = (
    feverDay: number,
    fluids?: Parameters<typeof evaluateRules>[0]["fluids"],
  ) =>
    evaluateRules({
      patient: {
        ageYears: 9,
        riskFactors: [],
        feverStart: new Date(now.getTime() - (feverDay - 0.9) * 864e5),
      },
      latestCheckIn: { createdAt: now, symptoms: { ...emptySymptoms } },
      labs: [],
      now,
      fluids,
    });
  const codes = (r: ReturnType<typeof evaluateRules>) =>
    r.reasons.map((x) => x.code);

  it("flags low intake in the evening of a critical-phase day", () => {
    const r = base(4, {
      todayMl: 400,
      targetMl: 1650,
      logged: true,
      localHour: 19,
    });
    expect(codes(r)).toContain("LOW_FLUIDS");
    expect(r.status).toBe("YELLOW");
  });
  it("does not judge in the morning", () => {
    expect(
      codes(
        base(4, { todayMl: 200, targetMl: 1650, logged: true, localHour: 9 }),
      ),
    ).not.toContain("LOW_FLUIDS");
  });
  it("does not judge if the family is not logging", () => {
    expect(
      codes(
        base(4, { todayMl: 0, targetMl: 1650, logged: false, localHour: 20 }),
      ),
    ).not.toContain("LOW_FLUIDS");
  });
  it("does not judge outside the critical phase", () => {
    expect(
      codes(
        base(2, { todayMl: 200, targetMl: 1650, logged: true, localHour: 20 }),
      ),
    ).not.toContain("LOW_FLUIDS");
  });
  it("enough intake is fine", () => {
    expect(
      codes(
        base(4, { todayMl: 1200, targetMl: 1650, logged: true, localHour: 20 }),
      ),
    ).not.toContain("LOW_FLUIDS");
  });
});
