import { AREAS, DISTRICTS, DIVISIONS, type Area } from "./areas";

/**
 * Forgiving Bangla key: drops nukta / hasanta / chandrabindu / joiners and merges spellings
 * people mix up when typing (ী/ি, ূ/ু, ং/ঙ, ণ/ন, শ/ষ/স, ৎ/ত), so "বেগমগন্জ" finds "বেগমগঞ্জ".
 */
export function normBn(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[়্ঁ‌‍]/g, "")
    .replace(/ী/g, "ি")
    .replace(/ূ/g, "ু")
    .replace(/ং/g, "ঙ")
    .replace(/ণ/g, "ন")
    .replace(/[শষ]/g, "স")
    .replace(/ৎ/g, "ত")
    .replace(/ঞ/g, "ন")
    .replace(/[^ঀ-৿]/g, "");
}

const latin = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Consonant skeleton of a romanised name: "begumgonj" and "Begumganj" both give "bgmgnj". */
export function skel(s: string): string {
  let t = latin(s).replace(/ph/g, "f").replace(/z/g, "j").replace(/w/g, "o").replace(/v/g, "b");
  if (!t) return "";
  t = t[0] + t.slice(1).replace(/[aeiouy]/g, "");
  return t.replace(/(.)\1+/g, "$1");
}

interface Keys {
  bn: string[];
  en: string[];
  sk: string[];
}
const keys = (bn: string[], en: string[]): Keys => ({
  bn: bn.map(normBn),
  en: en.map(latin),
  sk: en.map(skel),
});

const DISTRICT_KEYS = new Map(DISTRICTS.map((d) => [d.id, keys([d.bn], [d.en, ...(d.alt ?? [])])]));
const DIVISION_OF = new Map(DISTRICTS.map((d) => [d.id, d.divisionId]));
const DIVISION_KEYS = new Map(DIVISIONS.map((d) => [d.id, keys([d.bn], [d.en])]));
const INDEX = AREAS.map((a) => ({ area: a, k: keys([a.bn], [a.en]) }));

const isBangla = (t: string) => /[ঀ-৿]/.test(t);

/** How well one query token matches a set of keys: 3 prefix, 2 substring, 1.5 sound-alike, 0 none. */
function tokenScore(token: string, k: Keys): number {
  if (isBangla(token)) {
    const t = normBn(token);
    if (!t) return 0;
    if (k.bn.some((x) => x.startsWith(t))) return 3;
    if (t.length >= 2 && k.bn.some((x) => x.includes(t))) return 2;
    return 0;
  }
  const t = latin(token);
  if (!t) return 0;
  if (k.en.some((x) => x.startsWith(t))) return 3;
  if (t.length >= 3 && k.en.some((x) => x.includes(t))) return 2;
  const s = skel(token);
  if (t.length >= 3 && s.length >= 2 && k.sk.some((x) => x.startsWith(s))) return 1.5;
  return 0;
}

const STOP = /^(upazila|upazilla|thana|district|zila|zilla|উপজেলা|থানা|জেলা|বিভাগ|division)$/i;

/**
 * Search areas by Bangla, English or Banglish. Every word must match the area, its district or
 * its division ("companiganj sylhet", "নোয়াখালী"). Area-name matches rank above district matches.
 */
export function searchAreas(query: string, limit = 8): Area[] {
  const tokens = query
    .split(/[\s,।\-/]+/)
    .map((t) => t.trim())
    .filter((t) => t && !STOP.test(t));
  if (tokens.length === 0) return [];

  const scored: { area: Area; score: number }[] = [];
  for (const { area, k } of INDEX) {
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const own = tokenScore(t, k);
      const dist = tokenScore(t, DISTRICT_KEYS.get(area.d)!) * 0.6;
      const div = tokenScore(t, DIVISION_KEYS.get(DIVISION_OF.get(area.d)!)!) * 0.3;
      const best = Math.max(own, dist, div);
      if (best === 0) {
        ok = false;
        break;
      }
      score += best;
    }
    if (!ok) continue;
    // A district-only search ("নোয়াখালী") should list its sadar upazila first.
    if (/sadar/i.test(area.en)) score += 0.4;
    if (area.approx) score -= 0.1;
    scored.push({ area, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.area.bn.length - b.area.bn.length)
    .slice(0, limit)
    .map((s) => s.area);
}
