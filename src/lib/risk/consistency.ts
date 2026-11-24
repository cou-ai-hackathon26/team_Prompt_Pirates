import type { Mentioned, Symptoms } from "~/lib/ai/schemas";
import { toBn } from "~/lib/bn";

/**
 * Cross-checks between the caregiver's voice, the CBC report, the patient profile and history.
 *
 * Safety policy (presented to judges):
 *  1. Never lower risk on doubtful data. A suspicious *reassuring* number (an impossible platelet
 *     recovery, a "fine" message against a dangerous lab) is never allowed to bring the status down.
 *  2. Contradictory data is itself a reason to see a doctor: status is raised to at least YELLOW.
 *  3. Possible wrong patient (name / age / sex / two people in one message): the data is HELD and
 *     the family is asked "এটা কি রহিমের?". If they say no, nothing is saved for this patient, but if
 *     the data is dangerous they are told to take THAT person to hospital.
 *  4. Dangerous changes are never dismissed as "probably an error" (a falling platelet count or a
 *     rising HCT is believed).
 */
export type ConflictCode =
  | "NAME_MISMATCH"
  | "AGE_MISMATCH"
  | "SEX_MISMATCH"
  | "MULTIPLE_PATIENTS"
  | "FEVER_DAY_MISMATCH"
  | "REPORT_IN_FUTURE"
  | "REPORT_BEFORE_FEVER"
  | "REPORT_OLD"
  | "LAB_JUMP"
  | "SYMPTOMS_VS_LAB";

export interface Conflict {
  code: ConflictCode;
  /** identity = maybe another person (hold + ask); timing / clinical = explain + escalate */
  kind: "identity" | "timing" | "clinical";
  textBn: string;
  textEn: string;
}

export const IDENTITY_CODES = new Set<ConflictCode>([
  "NAME_MISMATCH",
  "AGE_MISMATCH",
  "SEX_MISMATCH",
  "MULTIPLE_PATIENTS",
]);

export interface Profile {
  nickname: string;
  ageYears: number;
  sex: string | null;
  feverStart: Date;
}

// ---------------------------------------------------------------- names

const HONORIFIC =
  /^(md|mohd|muhammad|mohammad|mohammed|mst|most|mosammat|mrs|mr|ms|miss|baby|master|late|dr|sk|demo|মোঃ|মো|মোছাঃ|মোসাম্মত|মোছাম্মৎ|বেবি|মাস্টার|ডেমো)$/i;

const BN_MAP: Record<string, string> = {
  ক: "k", খ: "k", গ: "g", ঘ: "g", ঙ: "ng", "ং": "ng", চ: "c", ছ: "c", জ: "j", ঝ: "j", য: "j", ঞ: "n",
  ট: "t", ঠ: "t", ত: "t", থ: "t", ৎ: "t", ড: "d", ঢ: "d", দ: "d", ধ: "d", ণ: "n", ন: "n",
  প: "p", ফ: "p", ব: "b", ভ: "b", ম: "m", র: "r", ল: "l", শ: "s", ষ: "s", স: "s", হ: "h",
};
const BN_INITIAL_VOWEL: Record<string, string> = {
  অ: "a", আ: "a", ই: "i", ঈ: "i", উ: "u", ঊ: "u", ঋ: "r", এ: "e", ঐ: "o", ও: "o", ঔ: "o",
};

/** Consonant skeleton of a Bangla-script name token: "রহিম" -> "rhm". */
function bnSkel(token: string): string {
  const t = token
    .normalize("NFC")
    .replace(/য়|য়/g, "") // ya-phala sound, acts as a vowel glide
    .replace(/ড়|ঢ়|ড়|ঢ়/g, "র");
  let out = "";
  [...t].forEach((ch, i) => {
    if (i === 0 && BN_INITIAL_VOWEL[ch]) out += BN_INITIAL_VOWEL[ch];
    else out += BN_MAP[ch] ?? "";
  });
  return out.replace(/(.)\1+/g, "$1");
}

/** Consonant skeleton of a romanised name token: "Rahim" -> "rhm", "Mohammad" -> "mhmd". */
function latinSkel(token: string): string {
  let t = token
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/sh/g, "s").replace(/ch/g, "c").replace(/kh/g, "k").replace(/th/g, "t")
    .replace(/dh/g, "d").replace(/bh/g, "b").replace(/gh/g, "g").replace(/ph/g, "p")
    .replace(/f/g, "p").replace(/z/g, "j").replace(/v/g, "b").replace(/q/g, "k").replace(/w/g, "");
  if (!t) return "";
  t = t[0] + t.slice(1).replace(/[aeiouy]/g, "");
  return t.replace(/(.)\1+/g, "$1");
}

function nameKeys(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s.,\-_/]+/)
    .filter((t) => t && !HONORIFIC.test(t))
    .map((t) => (/[ঀ-৿]/.test(t) ? bnSkel(t) : latinSkel(t)))
    .filter((k) => k.length >= 2);
}

/** Do two names (any script) plausibly refer to the same person? null if either is missing. */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean | null {
  if (!a?.trim() || !b?.trim()) return null;
  const ka = nameKeys(a);
  const kb = nameKeys(b);
  if (ka.length === 0 || kb.length === 0) return null;
  return ka.some((x) =>
    kb.some((y) => x === y || (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x)))),
  );
}

// ---------------------------------------------------------------- age / sex

/** "9 Y", "8Y 6M", "34 years", "6 M" (months), "15 D" (days), "৩৪ বছর" -> years. */
export function parseAgeYears(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).toLowerCase();
  const y = /(\d+(?:\.\d+)?)\s*(y|yr|yrs|year|years|বছর)/.exec(s);
  const m = /(\d+)\s*(m|mo|mon|month|months|মাস)\b/.exec(s);
  const d = /(\d+)\s*(d|day|days|দিন)\b/.exec(s);
  if (y || m || d)
    return Number(y?.[1] ?? 0) + Number(m?.[1] ?? 0) / 12 + Number(d?.[1] ?? 0) / 365;
  const n = /^\s*(\d{1,3})\s*$/.exec(s);
  return n ? Number(n[1]) : null;
}

export function parseSex(raw: string | null | undefined): "male" | "female" | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^(f|female|woman|girl|মহিলা|নারী|মেয়ে|স্ত্রী)/.test(s)) return "female";
  if (/^(m|male|man|boy|পুরুষ|ছেলে)/.test(s)) return "male";
  return null;
}

const agesDiffer = (a: number, b: number) =>
  Math.abs(a - b) > Math.max(2, 0.2 * Math.max(a, b));

const SEX_BN = { male: "ছেলে / পুরুষ", female: "মেয়ে / নারী" } as const;
const ageBn = (y: number) => (y < 1 ? `${toBn(Math.round(y * 12))} মাস` : `${toBn(Math.round(y))} বছর`);

/** Name / age / sex claimed by a CBC report or a voice message vs the patient profile. */
export function identityConflicts(
  profile: Profile,
  claimed: { name?: string | null; ageYears?: number | null; sex?: "male" | "female" | null },
  where: "report" | "voice",
): Conflict[] {
  const out: Conflict[] = [];
  const src = where === "report" ? "রিপোর্টে" : "কথায়";
  const srcEn = where === "report" ? "Report" : "Voice message";
  if (namesMatch(profile.nickname, claimed.name) === false)
    out.push({
      code: "NAME_MISMATCH",
      kind: "identity",
      textBn: `${src} নাম "${claimed.name}", রোগীর নাম "${profile.nickname}"`,
      textEn: `${srcEn} name "${claimed.name}" ≠ patient "${profile.nickname}"`,
    });
  if (claimed.ageYears != null && agesDiffer(claimed.ageYears, profile.ageYears))
    out.push({
      code: "AGE_MISMATCH",
      kind: "identity",
      textBn: `${src} বয়স ${ageBn(claimed.ageYears)}, রোগীর বয়স ${ageBn(profile.ageYears)}`,
      textEn: `${srcEn} age ${Math.round(claimed.ageYears)} y ≠ patient ${profile.ageYears} y`,
    });
  const ps = parseSex(profile.sex);
  if (claimed.sex && ps && claimed.sex !== ps)
    out.push({
      code: "SEX_MISMATCH",
      kind: "identity",
      textBn: `${src} ${SEX_BN[claimed.sex]}, কিন্তু রোগী ${SEX_BN[ps]}`,
      textEn: `${srcEn} sex ${claimed.sex} ≠ patient ${ps}`,
    });
  return out;
}

/** Checks on a confirmed voice check-in. */
export function voiceConflicts(profile: Profile, mentioned: Mentioned, dayOfFever: number): Conflict[] {
  const out = identityConflicts(profile, mentioned, "voice");
  if (mentioned.multiplePatients)
    out.push({
      code: "MULTIPLE_PATIENTS",
      kind: "identity",
      textBn: "কথায় একাধিক অসুস্থ মানুষের কথা আছে",
      textEn: "Message describes more than one sick person",
    });
  if (mentioned.feverDay != null && Math.abs(mentioned.feverDay - dayOfFever) >= 2)
    out.push({
      code: "FEVER_DAY_MISMATCH",
      kind: "timing",
      textBn: `কথায় জ্বরের ${toBn(mentioned.feverDay)} নম্বর দিন, অ্যাপে ${toBn(dayOfFever)} নম্বর দিন। জ্বর শুরুর তারিখ ঠিক আছে কিনা দেখুন`,
      textEn: `Caregiver says fever day ${mentioned.feverDay}, record says day ${dayOfFever}`,
    });
  return out;
}

// ---------------------------------------------------------------- reports

export interface LabPoint {
  takenAt: Date;
  plateletUl: number | null;
  hctPct: number | null;
}

const H = 3600e3;
const plt = (n: number) => toBn(n.toLocaleString("en-IN"));

/** Report date and plausibility vs the previous report. */
export function reportConflicts(input: {
  lab: LabPoint;
  previous: LabPoint[];
  feverStart: Date;
  now: Date;
}): Conflict[] {
  const { lab, feverStart, now } = input;
  const out: Conflict[] = [];
  if (lab.takenAt.getTime() > now.getTime() + 12 * H)
    out.push({
      code: "REPORT_IN_FUTURE",
      kind: "timing",
      textBn: "রিপোর্টের তারিখ ভবিষ্যতের, তারিখ ঠিক করে দিন",
      textEn: "Report date is in the future",
    });
  else if (lab.takenAt.getTime() < feverStart.getTime() - 3 * 24 * H)
    out.push({
      code: "REPORT_BEFORE_FEVER",
      kind: "timing",
      textBn: "রিপোর্টটি জ্বর শুরুর আগের, এখনকার অবস্থা বোঝায় না",
      textEn: "Report predates the fever onset",
    });
  else if (now.getTime() - lab.takenAt.getTime() > 3 * 24 * H)
    out.push({
      code: "REPORT_OLD",
      kind: "timing",
      textBn: "রিপোর্টটি ৩ দিনের বেশি পুরোনো, নতুন CBC করানো ভালো",
      textEn: "Report older than 3 days",
    });

  // Only an implausibly fast IMPROVEMENT is suspicious; a fast fall is believed (policy 4).
  const prev = input.previous
    .filter((p) => p.takenAt < lab.takenAt && p.plateletUl != null)
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0];
  if (
    prev?.plateletUl != null &&
    lab.plateletUl != null &&
    lab.takenAt.getTime() - prev.takenAt.getTime() <= 36 * H &&
    lab.plateletUl >= 4 * prev.plateletUl
  )
    out.push({
      code: "LAB_JUMP",
      kind: "clinical",
      textBn: `প্লাটিলেট ${plt(prev.plateletUl)} থেকে এক দিনে ${plt(lab.plateletUl)}, এত দ্রুত বাড়া অস্বাভাবিক। রিপোর্টটি এই রোগীর কিনা দেখুন। ঝুঁকি কমানো হয়নি`,
      textEn: `Platelets rose ${prev.plateletUl} → ${lab.plateletUl} within 36 h (implausible; risk not lowered)`,
    });
  return out;
}

// ---------------------------------------------------------------- voice vs lab

const RED_SIGNS: (keyof Symptoms)[] = [
  "bleedingGums",
  "bleedingNose",
  "vomitBlood",
  "blackStool",
  "bleedingOther",
  "drowsyOrRestless",
  "coldClammyHands",
  "noUrine6h",
  "breathingDifficulty",
];

/** The day's symptoms say "doing well": no warning sign, and the caregiver explicitly said so. */
function soundsWell(s: Symptoms): boolean {
  const anyDanger =
    RED_SIGNS.some((k) => s[k] === true) ||
    s.abdominalPain === "severe" ||
    (s.vomitingCount24h ?? 0) >= 3 ||
    s.canDrinkFluids === false;
  const saidFine =
    s.canDrinkFluids === true ||
    s.abdominalPain === "none" ||
    s.vomitingCount24h === 0 ||
    s.bleedingGums === false ||
    s.bleedingOther === false;
  return !anyDanger && saidFine;
}

/** The day's check-ins and a same-day CBC point in opposite directions. */
export function symptomsVsLab(day: Symptoms | null, lab: LabPoint | null, dayStart: Date): Conflict | null {
  if (!day || !lab || lab.takenAt < new Date(dayStart.getTime() - 24 * H)) return null;
  if (soundsWell(day) && lab.plateletUl != null && lab.plateletUl < 50_000)
    return {
      code: "SYMPTOMS_VS_LAB",
      kind: "clinical",
      textBn: `কথায় রোগী ভালো আছে, কিন্তু প্লাটিলেট মাত্র ${plt(lab.plateletUl)}। রিপোর্টকে গুরুত্ব দেওয়া হয়েছে`,
      textEn: `Caregiver reports well, but platelets ${lab.plateletUl}/µL; lab given priority`,
    };
  const severe = RED_SIGNS.some((k) => day[k] === true);
  if (severe && lab.plateletUl != null && lab.plateletUl >= 150_000 && (lab.hctPct ?? 0) < 45)
    return {
      code: "SYMPTOMS_VS_LAB",
      kind: "clinical",
      textBn: "লক্ষণ গুরুতর, কিন্তু রিপোর্ট স্বাভাবিক। রিপোর্ট পুরোনো বা অন্য কারো হতে পারে; লক্ষণকে গুরুত্ব দেওয়া হয়েছে",
      textEn: "Severe warning signs but normal CBC (old / wrong report?); symptoms given priority",
    };
  return null;
}
