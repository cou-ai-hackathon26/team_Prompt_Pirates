import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, reminderEvents } from "../reminders";

const DAY = 864e5;

describe("reminderEvents", () => {
  // now = 24 Nov 10:00 Dhaka (04:00Z); fever started 2.5 days ago -> today is fever day 3
  const now = new Date("2026-11-24T04:00:00Z");
  const feverStart = new Date(now.getTime() - 2.5 * DAY);
  const ev = reminderEvents({
    patientName: "রহিম",
    feverStart,
    now,
    checkinUrl: "https://x/p/1/checkin",
  });

  it("starts with the next future slot (today 20:00 Dhaka)", () => {
    expect(ev[0]!.start.toISOString()).toBe("2026-11-24T14:00:00.000Z");
  });
  it("covers the critical phase up to fever day 7, morning and evening", () => {
    expect(ev.at(-1)!.feverDay).toBe(7);
    expect(ev.every((e) => [3, 14].includes(e.start.getUTCHours()))).toBe(true);
  });
  it("mentions the critical phase and the check-in link", () => {
    expect(ev[0]!.description).toContain("সংকটকাল");
    expect(ev[0]!.description).toContain("https://x/p/1/checkin");
  });
  it("a late sign-up (day 7) still gets at least the next 2 days", () => {
    const late = reminderEvents({
      patientName: "x",
      feverStart: new Date(now.getTime() - 6.5 * DAY),
      now,
      checkinUrl: "u",
    });
    expect(late.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ics output", () => {
  it("is a valid calendar with alarms and CRLF lines", () => {
    const now = new Date("2026-11-24T04:00:00Z");
    const ics = buildIcs(
      reminderEvents({
        patientName: "রহিম",
        feverStart: new Date(now.getTime() - 2.5 * DAY),
        now,
        checkinUrl: "u",
      }),
      { uidPrefix: "p1", now, url: "https://x" },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(
      ics.match(/BEGIN:VEVENT/g)?.length,
    );
    expect(ics).toContain("DTSTART:20261124T140000Z");
  });

  it("folds long Bangla lines at <= 75 bytes without breaking characters", () => {
    const line = "SUMMARY:" + "ডেঙ্গুসাথী ".repeat(12);
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split("\r\n"))
      expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
