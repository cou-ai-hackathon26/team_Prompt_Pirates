import { describe, expect, it } from "vitest";
import { emptySymptoms } from "~/lib/ai/schemas";
import { mergeDaySymptoms } from "~/lib/risk/merge-day";

describe("mergeDaySymptoms", () => {
  it("keeps a morning danger sign when the evening message says the patient is fine", () => {
    const morning = { ...emptySymptoms, bleedingGums: true, vomitingCount24h: 2 };
    const evening = { ...emptySymptoms, bleedingGums: false, vomitingCount24h: 0, fever: false };
    const day = mergeDaySymptoms([morning, evening]);
    expect(day.bleedingGums).toBe(true);
    expect(day.vomitingCount24h).toBe(2);
  });

  it("fills fields only mentioned in one of the messages", () => {
    const a = { ...emptySymptoms, temperatureF: 101 };
    const b = { ...emptySymptoms, noUrine6h: true, temperatureF: 103 };
    const day = mergeDaySymptoms([a, b]);
    expect(day.temperatureF).toBe(103);
    expect(day.noUrine6h).toBe(true);
  });

  it("keeps the worst pain and the inability to drink", () => {
    const day = mergeDaySymptoms([
      { ...emptySymptoms, abdominalPain: "severe", canDrinkFluids: false },
      { ...emptySymptoms, abdominalPain: "mild", canDrinkFluids: true },
    ]);
    expect(day.abdominalPain).toBe("severe");
    expect(day.canDrinkFluids).toBe(false);
  });

  it("returns a single check-in unchanged", () => {
    const s = { ...emptySymptoms, fever: true };
    expect(mergeDaySymptoms([s])).toEqual(s);
  });
});
