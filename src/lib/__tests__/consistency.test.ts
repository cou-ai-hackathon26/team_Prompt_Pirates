import { describe, expect, it } from "vitest";
import { emptyMentioned, emptySymptoms } from "~/lib/ai/schemas";
import {
  identityConflicts,
  namesMatch,
  parseAgeYears,
  parseSex,
  reportConflicts,
  symptomsVsLab,
  voiceConflicts,
} from "~/lib/risk/consistency";

const now = new Date("2026-11-24T10:00:00Z");
const H = 3600e3;
const rahim = {
  nickname: "রহিম (ডেমো)",
  ageYears: 9,
  sex: "male",
  feverStart: new Date(now.getTime() - 3.4 * 24 * H),
};
const codes = (c: { code: string }[]) => c.map((x) => x.code);

describe("namesMatch across Bangla and English", () => {
  it("matches the same name in either script, ignoring honorifics and (DEMO)", () => {
    expect(namesMatch("রহিম (ডেমো)", "Rahim Uddin (DEMO)")).toBe(true);
    expect(namesMatch("মোহাম্মদ হোসেন", "Md. Hossain")).toBe(true);
    expect(namesMatch("আয়েশা", "Ayesha Akter")).toBe(true);
    expect(namesMatch("আরিফ", "Arif")).toBe(true);
  });

  it("does not match a different person", () => {
    expect(namesMatch("রহিম", "Nasrin Akter (DEMO)")).toBe(false);
    expect(namesMatch("রহিম", "Kamal Hossain")).toBe(false);
  });

  it("is unknown when a name is missing", () => {
    expect(namesMatch("রহিম", null)).toBeNull();
  });
});

describe("age and sex parsing", () => {
  it("reads common report formats", () => {
    expect(parseAgeYears("9 Y")).toBe(9);
    expect(parseAgeYears("8Y 6M")).toBe(8.5);
    expect(parseAgeYears("6 M")).toBe(0.5);
    expect(parseAgeYears("৩৪ বছর")).toBe(34);
    expect(parseSex("F")).toBe("female");
    expect(parseSex("Male")).toBe("male");
  });
});

describe("identity conflicts (wrong patient)", () => {
  it("flags another person's CBC (Nasrin, 31 F on Rahim, 9 M)", () => {
    const c = identityConflicts(rahim, { name: "Nasrin Akter (DEMO)", ageYears: 31, sex: "female" }, "report");
    expect(codes(c)).toEqual(["NAME_MISMATCH", "AGE_MISMATCH", "SEX_MISMATCH"]);
  });

  it("accepts the patient's own report", () => {
    expect(identityConflicts(rahim, { name: "Rahim Uddin (DEMO)", ageYears: 9, sex: "male" }, "report")).toEqual([]);
  });

  it("flags a voice message about someone else and two patients in one message", () => {
    const c = voiceConflicts(rahim, { ...emptyMentioned, ageYears: 65, sex: "male", multiplePatients: true }, 4);
    expect(codes(c)).toEqual(["AGE_MISMATCH", "MULTIPLE_PATIENTS"]);
  });

  it("flags a fever day that disagrees with the record", () => {
    expect(codes(voiceConflicts(rahim, { ...emptyMentioned, feverDay: 7 }, 4))).toEqual(["FEVER_DAY_MISMATCH"]);
    expect(voiceConflicts(rahim, { ...emptyMentioned, feverDay: 5 }, 4)).toEqual([]);
  });
});

describe("report timing and plausibility", () => {
  const base = { previous: [], feverStart: rahim.feverStart, now };

  it("flags future, pre-fever and old reports", () => {
    const lab = (h: number) => ({ takenAt: new Date(now.getTime() + h * H), plateletUl: 150_000, hctPct: 40 });
    expect(codes(reportConflicts({ ...base, lab: lab(48) }))).toEqual(["REPORT_IN_FUTURE"]);
    expect(codes(reportConflicts({ ...base, lab: lab(-24 * 10) }))).toEqual(["REPORT_BEFORE_FEVER"]);
    expect(codes(reportConflicts({ ...base, feverStart: new Date(now.getTime() - 9 * 24 * H), lab: lab(-24 * 5) }))).toEqual(["REPORT_OLD"]);
  });

  it("flags an impossible overnight platelet recovery but believes a fast fall", () => {
    const prev = { takenAt: new Date(now.getTime() - 20 * H), plateletUl: 30_000, hctPct: 44 };
    const up = { takenAt: now, plateletUl: 180_000, hctPct: 40 };
    const down = { takenAt: now, plateletUl: 30_000, hctPct: 44 };
    expect(codes(reportConflicts({ ...base, previous: [prev], lab: up }))).toEqual(["LAB_JUMP"]);
    expect(reportConflicts({ ...base, previous: [{ ...prev, plateletUl: 160_000 }], lab: down })).toEqual([]);
  });
});

describe("symptoms vs lab", () => {
  const lab = (plateletUl: number, hctPct = 40) => ({ takenAt: now, plateletUl, hctPct });
  const dayStart = new Date(now.getTime() - 4 * H);

  it("flags 'doing well' against a dangerously low platelet count", () => {
    const fine = { ...emptySymptoms, canDrinkFluids: true, vomitingCount24h: 0 };
    expect(symptomsVsLab(fine, lab(30_000), dayStart)?.code).toBe("SYMPTOMS_VS_LAB");
  });

  it("flags severe warning signs against a completely normal report", () => {
    const bad = { ...emptySymptoms, bleedingGums: true };
    expect(symptomsVsLab(bad, lab(220_000), dayStart)?.code).toBe("SYMPTOMS_VS_LAB");
  });

  it("is quiet when voice and lab agree", () => {
    const bad = { ...emptySymptoms, bleedingGums: true };
    expect(symptomsVsLab(bad, lab(40_000), dayStart)).toBeNull();
    expect(symptomsVsLab({ ...emptySymptoms, canDrinkFluids: true }, lab(180_000), dayStart)).toBeNull();
  });
});
