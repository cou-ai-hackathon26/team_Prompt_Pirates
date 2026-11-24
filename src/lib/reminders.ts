/**
 * Calendar reminders (.ics) for the critical phase. Families add them to the phone's own calendar,
 * so alarms fire even when the app is closed, with no push server, no login and no cost.
 */
import { toBn } from "./bn";
import { THRESHOLDS as T } from "./risk/thresholds";

const DAY = 864e5;
/** Local (Dhaka, UTC+6) times of the two daily reminders. */
export const REMINDER_HOURS = [9, 20] as const;

export interface ReminderEvent {
  start: Date;
  feverDay: number;
  title: string;
  description: string;
}

/**
 * One morning and one evening reminder for every remaining day up to the end of the critical phase
 * (and at least the next 2 days, so a patient who signs up late still gets reminders).
 */
export function reminderEvents(opts: {
  patientName: string;
  feverStart: Date;
  now: Date;
  checkinUrl: string;
}): ReminderEvent[] {
  const { patientName, feverStart, now, checkinUrl } = opts;
  const out: ReminderEvent[] = [];
  // fever day N starts at feverStart + (N-1) days; iterate calendar days in Dhaka time
  const dhakaMidnight = (d: Date) => {
    const s = new Date(d.getTime() + 6 * 3600e3);
    s.setUTCHours(0, 0, 0, 0);
    return s.getTime() - 6 * 3600e3;
  };
  const lastDay = Math.max(
    T.criticalPhaseEndDay,
    Math.floor((now.getTime() - feverStart.getTime()) / DAY) + 3,
  );
  for (let dayStart = dhakaMidnight(now); ; dayStart += DAY) {
    for (const hour of REMINDER_HOURS) {
      const start = new Date(dayStart + hour * 3600e3);
      if (start <= now) continue;
      const feverDay =
        Math.floor((start.getTime() - feverStart.getTime()) / DAY) + 1;
      if (feverDay > lastDay) return out;
      const critical =
        feverDay >= T.criticalPhaseStartDay &&
        feverDay <= T.criticalPhaseEndDay;
      out.push({
        start,
        feverDay,
        title: `ডেঙ্গুসাথী: ${patientName}-এর ${hour < 12 ? "সকালের" : "রাতের"} আপডেট দিন`,
        description:
          `জ্বরের ${toBn(feverDay)} নম্বর দিন${critical ? " (সংকটকাল: জ্বর কমলেও সতর্ক থাকুন)" : ""}। ` +
          `পেটব্যথা, বমি, রক্তপাত, ঝিমুনি বা প্রস্রাব কম হলে এখনই হাসপাতালে যান। ` +
          `আপডেট দিন: ${checkinUrl}`,
      });
    }
    if (out.length > 40) return out; // safety cap
  }
}

const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");

/** RFC 5545 line folding at 75 octets, never splitting a UTF-8 character (Bangla is 3 bytes/char). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function buildIcs(
  events: ReminderEvent[],
  opts: { uidPrefix: string; now: Date; url: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DengueSathi//Reminders//BN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ডেঙ্গুসাথী রিমাইন্ডার",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${opts.uidPrefix}-${icsDate(e.start)}@denguesathi`,
      `DTSTAMP:${icsDate(opts.now)}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(new Date(e.start.getTime() + 10 * 60e3))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.description)}`,
      `URL:${opts.url}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
