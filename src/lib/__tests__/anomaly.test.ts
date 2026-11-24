import { describe, expect, it } from "vitest";
import { dhakaDay, detectSpike, fillDays, lastNDays } from "../anomaly";

const series = (counts: number[]) =>
  counts.map((count, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, count }));

describe("detectSpike", () => {
  it("flags a clear spike over a steady baseline", () => {
    const r = detectSpike(series([1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 7]));
    expect(r.isSpike).toBe(true);
    expect(r.ratio).toBeGreaterThan(4);
  });

  it("does not flag normal variation", () => {
    expect(detectSpike(series([3, 5, 4, 6, 3, 5, 4, 6, 5, 4, 3, 5, 6, 4, 6])).isSpike).toBe(false);
  });

  it("needs at least 3 cases, even from zero", () => {
    expect(detectSpike(series([0, 0, 0, 0, 0, 0, 0, 2])).isSpike).toBe(false);
    expect(detectSpike(series([0, 0, 0, 0, 0, 0, 0, 3])).isSpike).toBe(true);
  });

  it("ignores small rises over a very steady baseline (Poisson floor + 1.5x rule)", () => {
    // flat baseline of 6: SD 0, but Poisson spread is sqrt(6) = 2.45
    expect(detectSpike(series([6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8])).isSpike).toBe(false);
    expect(detectSpike(series([6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 12])).isSpike).toBe(true);
  });

  it("does not flag 2 -> 4 (random noise for small counts)", () => {
    expect(detectSpike(series([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4])).isSpike).toBe(false);
  });

  it("handles empty and single-day series", () => {
    expect(detectSpike([]).isSpike).toBe(false);
    expect(detectSpike(series([5])).z).toBeNull();
  });

  it("is independent of input order", () => {
    const s = series([1, 1, 1, 1, 1, 1, 6]);
    expect(detectSpike([...s].reverse())).toEqual(detectSpike(s));
  });
});

describe("day helpers", () => {
  it("fillDays fills gaps with zero", () => {
    expect(fillDays(new Map([["2026-11-02", 4]]), ["2026-11-01", "2026-11-02"])).toEqual([
      { day: "2026-11-01", count: 0 },
      { day: "2026-11-02", count: 4 },
    ]);
  });

  it("dhakaDay uses UTC+6", () => {
    expect(dhakaDay(new Date("2026-11-21T19:00:00Z"))).toBe("2026-11-22");
    expect(dhakaDay(new Date("2026-11-21T17:00:00Z"))).toBe("2026-11-21");
  });

  it("lastNDays returns n days ending today", () => {
    const d = lastNDays(3, new Date("2026-11-22T06:00:00Z"));
    expect(d).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
  });
});
