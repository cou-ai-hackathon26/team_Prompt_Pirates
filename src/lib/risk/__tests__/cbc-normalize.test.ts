import { describe, expect, it } from "vitest";
import type { CbcExtraction } from "~/lib/ai/schemas";
import { normalizeCbc, parseCount } from "../cbc-normalize";

describe("parseCount", () => {
  it.each<[string, string | null, number]>([
    ["150000", "/cumm", 150_000],
    ["1,50,000", "/cumm", 150_000],
    ["150,000", null, 150_000],
    ["150", "x10^3/uL", 150_000],
    ["45", "K/uL", 45_000],
    ["150", "x10^9/L", 150_000],
    ["1.5 lakh", null, 150_000],
    ["45", null, 45_000],
    ["7.5", "x 10³/µL", 7_500],
    ["7500", "/cumm", 7_500],
  ])("%s %s -> %d", (raw, unit, expected) => {
    expect(parseCount(raw, unit)).toBe(expected);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseCount(null, null)).toBeNull();
    expect(parseCount("N/A", null)).toBeNull();
  });
});

describe("normalizeCbc", () => {
  const base: CbcExtraction = {
    isCbcReport: true,
    plateletRaw: "45,000",
    plateletUnit: "/cumm",
    hematocritPct: 46,
    wbcRaw: "3.2",
    wbcUnit: "x10^3/uL",
    hemoglobinGdl: 14,
    reportDate: null,
    labName: null,
    patientName: null,
    patientAgeRaw: null,
    patientSexRaw: null,
    confidence: "high",
  };

  it("normalises a typical report", () => {
    expect(normalizeCbc(base)).toEqual({
      plateletUl: 45_000,
      hctPct: 46,
      wbcUl: 3_200,
      hbGdl: 14,
      rejected: [],
    });
  });

  it("rejects impossible values instead of trusting the model", () => {
    const r = normalizeCbc({ ...base, hematocritPct: 460, hemoglobinGdl: 140 });
    expect(r.hctPct).toBeNull();
    expect(r.hbGdl).toBeNull();
    expect(r.rejected).toEqual(["hematocrit", "hemoglobin"]);
  });
});
