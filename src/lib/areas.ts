import data from "~/data/bd-locations.json";
import { haversineKm } from "./geo";

/**
 * All of Bangladesh: 8 divisions, 64 districts, ~570 upazilas and city thanas.
 * Built by scripts/data/import-bd-locations.mjs (bd_geo_code names, OpenStreetMap centres).
 * Patients pick an area; no GPS is stored, for privacy.
 */
export interface Division {
  id: number;
  en: string;
  bn: string;
}
export interface District extends Division {
  divisionId: number;
  lat: number;
  lng: number;
  alt?: string[];
}
export interface Area {
  id: string;
  /** district id */
  d: number;
  en: string;
  bn: string;
  lat: number;
  lng: number;
  /** centre not verified against OpenStreetMap; excluded from GPS suggestions */
  approx?: boolean;
}

export const DIVISIONS = data.divisions as Division[];
export const DISTRICTS = data.districts as District[];
export const AREAS = data.areas as Area[];

const AREA_BY_ID = new Map(AREAS.map((a) => [a.id, a]));
const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));
const DIVISION_BY_ID = new Map(DIVISIONS.map((d) => [d.id, d]));

/** IDs used before the nationwide list (kept so old patient records still resolve). */
const LEGACY_IDS: Record<string, string> = {
  "noakhali-sadar": "noakhali.noakhali-sadar",
  sonapur: "noakhali.sonapur",
  begumganj: "noakhali.begumganj",
  companiganj: "noakhali.companiganj",
  mirpur: "dhaka.mirpur",
  uttara: "dhaka.uttara-west",
  jatrabari: "dhaka.jatrabari",
  mohammadpur: "dhaka.mohammadpur",
  "chattogram-sadar": "chattogram.kotwali",
  "cumilla-sadar": "cumilla.cumilla-sadar",
};

export const DEFAULT_AREA_ID = "noakhali.noakhali-sadar";

/** Canonical ID for a stored area value (maps legacy IDs). */
export const resolveAreaId = (id: string) => LEGACY_IDS[id] ?? id;
export const getArea = (id: string): Area | undefined => AREA_BY_ID.get(resolveAreaId(id));
export const isValidArea = (id: string) => AREA_BY_ID.has(resolveAreaId(id));
export const getDistrict = (id: number) => DISTRICT_BY_ID.get(id);
export const getDivision = (id: number) => DIVISION_BY_ID.get(id);
export const areasOfDistrict = (districtId: number) => AREAS.filter((a) => a.d === districtId);

/** "বেগমগঞ্জ, নোয়াখালী" (the district disambiguates repeated names like কোম্পানীগঞ্জ). */
export function areaName(id: string): string {
  const a = getArea(id);
  if (!a) return id;
  const d = getDistrict(a.d);
  return d && d.bn !== a.bn ? `${a.bn}, ${d.bn}` : a.bn;
}

/** "Begumganj, Noakhali" for the English clinical handoff card. */
export function areaNameEn(id: string): string {
  const a = getArea(id);
  if (!a) return id;
  const d = getDistrict(a.d);
  return d && d.en !== a.en ? `${a.en}, ${d.en}` : a.en;
}

/** Nearest area with a verified centre, or null if the point is clearly outside Bangladesh. */
export function nearestArea(point: { lat: number; lng: number }, maxKm = 40) {
  let best: { area: Area; km: number } | null = null;
  for (const a of AREAS) {
    if (a.approx) continue;
    const km = haversineKm(point, a);
    if (!best || km < best.km) best = { area: a, km };
  }
  return best && best.km <= maxKm ? best : null;
}
