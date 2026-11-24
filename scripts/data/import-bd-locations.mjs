/**
 * One-time import of all Bangladesh divisions, districts and upazilas / city thanas.
 * Source: the public bd_geo_code dataset (github.com/nuhil/bangladesh-geocode), as seeded in
 * the team's rokto backend (database/seeders/{DivisionSeeder,DistrictSeeder,ThanaSeeder}.php).
 *
 * Run:  node scripts/data/import-bd-locations.mjs "<path to rokto_backend_docker>"
 *       -> writes src/data/bd-locations.json (committed; no runtime dependency on the source)
 *
 * Cleanup applied here: official English spellings, Bangla typo fixes, duplicate thanas merged,
 * "Thana" suffix dropped, a few missing city areas added, coordinate outliers snapped to the
 * district centre and marked approximate.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node scripts/data/import-bd-locations.mjs <rokto_backend_docker path>");
  process.exit(1);
}
const php = (f) => readFileSync(join(root, "database/seeders", f), "utf8");

const ROW =
  /\[\s*'id'\s*=>\s*'?(\d+)'?,\s*'(?:district|division|country)_id'\s*=>\s*'?(\d+)'?,\s*'name'\s*=>\s*["']([^"']+)["'],\s*'bn_name'\s*=>\s*["']([^"']+)["'](?:,\s*'lat'\s*=>\s*'?([\d.]+)'?,\s*'lon'\s*=>\s*'?([\d.]+))?/g;
const DIV_ROW = /\[\s*.id.\s*=>\s*(\d+),\s*.bn_name.\s*=>\s*'([^']+)',\s*.country_id.\s*=>\s*\d+,\s*.name.\s*=>\s*'([^']+)'/g;

const slug = (s) =>
  s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const round = (n) => Math.round(Number(n) * 1e4) / 1e4;
const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ---------- divisions ----------
const DIV_EN = { Chattogram: "Chattogram", Barishal: "Barishal" };
const divisions = [...php("DivisionSeeder.php").matchAll(DIV_ROW)].map(([, id, bn, en]) => ({
  id: Number(id),
  en: DIV_EN[en] ?? en,
  bn,
}));

// ---------- districts ----------
const DIST_FIX = {
  Comilla: { en: "Cumilla", alt: ["Comilla"] },
  Barisal: { en: "Barishal", alt: ["Barisal"] },
  Coxsbazar: { en: "Cox's Bazar", alt: ["Coxsbazar", "Coxs Bazar"] },
  Chattogram: { alt: ["Chittagong", "Ctg"] },
  Jashore: { alt: ["Jessore"] },
  Bogura: { alt: ["Bogra"] },
  Jhalakathi: { alt: ["Jhalokati"] },
  Netrokona: { alt: ["Netrakona"] },
  Moulvibazar: { alt: ["Maulvibazar"] },
  Chapainawabganj: { alt: ["Nawabganj", "Chapai"] },
  Brahmanbaria: { alt: ["B.Baria", "Bbaria"] },
};
const districts = [...php("DistrictSeeder.php").matchAll(ROW)].map(([, id, divisionId, en, bn, lat, lng]) => {
  const fix = DIST_FIX[en] ?? {};
  return {
    id: Number(id),
    divisionId: Number(divisionId),
    en: fix.en ?? en,
    bn,
    lat: round(lat),
    lng: round(lng),
    ...(fix.alt ? { alt: fix.alt } : {}),
  };
});
const distById = new Map(districts.map((d) => [d.id, d]));

// ---------- upazilas / thanas ----------
/** Bangla / English name fixes, keyed by "<districtId>:<source English name>". null = drop (duplicate). */
const AREA_FIX = {
  // Dhaka city
  "47:Mirpur Model Thana": { en: "Mirpur", bn: "মিরপুর" },
  "47:Mohammadpur Thana": { bn: "মোহাম্মদপুর" },
  "47:Lalbagh Thana": { bn: "লালবাগ" },
  "47:Hazaribagh Thana": { bn: "হাজারীবাগ" },
  "47:Sabujbagh Thana": { bn: "সবুজবাগ" },
  "47:Kotwali Thana (Dhaka)": { en: "Kotwali", bn: "কোতোয়ালী" },
  "47:Khilgaon Thana": { bn: "খিলগাঁও" },
  "47:Khilkhet Thana": { bn: "খিলক্ষেত" },
  "47:Kamrangirchar Thana": { bn: "কামরাঙ্গীরচর" },
  "47:Pallabi Thana": { bn: "পল্লবী" },
  "47:Wari Thana": { bn: "ওয়ারী" },
  "47:Shah Ali Thana": { bn: "শাহ আলী" },
  "47:Shahbag Thana": { bn: "শাহবাগ" },
  "47:Dakshinkhan Thana": { bn: "দক্ষিণখান" },
  "47:Kadamtali Thana": { bn: "কদমতলী" },
  "47:Sher-e-Bangla Nagar": { bn: "শেরেবাংলা নগর" },
  "47:Tejgaon Industrial Area Thana": { en: "Tejgaon Industrial Area", bn: "তেজগাঁও শিল্পাঞ্চল" },
  "47:Sutrapur Thana": { bn: "সূত্রাপুর" },
  "47:Bimanbandar Thana (Dhaka)": { en: "Bimanbandar", bn: "বিমানবন্দর" },
  "47:Keraniganj": { bn: "কেরানীগঞ্জ" },
  "47:Uttar Khan Thana": { bn: "উত্তরখান" },
  "47:Darus Salam Thana": { bn: "দারুস সালাম" },
  "47:Kafrul Thana": { bn: "কাফরুল" },
  "47:Vatara Thana": { bn: "ভাটারা" },
  // Chattogram city
  "8:Chittagong Kotwali Thana": null,
  "8:Karnaphuli Thana": null,
  "8:Kotwali Thana (Chittagong)": { en: "Kotwali", bn: "কোতোয়ালী" },
  "8:Chandgaon Thana": { bn: "চান্দগাঁও" },
  "8:Double Mooring Thana": { bn: "ডবলমুরিং" },
  "8:Pahartali Thana": { bn: "পাহাড়তলী" },
  "8:Panchlaish Thana": { bn: "পাঁচলাইশ" },
  "8:Patenga Thana": { bn: "পতেঙ্গা" },
  "8:Khulshi Thana": { bn: "খুলশী" },
  "8:Bakoliya Thana": { en: "Bakalia", bn: "বাকলিয়া" },
  "8:Bayazid Thana": { bn: "বায়েজিদ বোস্তামী" },
  "8:EPZ Thana Thana": { en: "EPZ", bn: "ইপিজেড" },
  "8:Sitakunda": { bn: "সীতাকুণ্ড" },
  "8:Chaowkbazar Thana": { en: "Chawkbazar", bn: "চকবাজার" },
  "8:Akbarshah Thana": { bn: "আকবরশাহ" },
  "8:Halishahar Thana": { bn: "হালিশহর" },
  "8:Bhujpur Thana": { bn: "ভূজপুর" },
  // Bhola: misspelt duplicate of "Borhan Uddin"
  "34:Borhan Sddin": null,
  // Cumilla
  "1:Comilla Sadar": { en: "Cumilla Sadar" },
  "1:Sadarsouth": { en: "Cumilla Sadar South", bn: "কুমিল্লা সদর দক্ষিণ" },
};

/** Areas the source lacks. Sonapur is the dashboard's demo outbreak area. */
const EXTRA = [
  { districtId: 5, en: "Sonapur", bn: "সোনাপুর", lat: 22.8236, lng: 91.1003 },
  { districtId: 47, en: "Jatrabari", bn: "যাত্রাবাড়ী", lat: 23.7104, lng: 90.4348 },
  { districtId: 47, en: "Mugda", bn: "মুগদা", lat: 23.734, lng: 90.431 },
  { districtId: 47, en: "Shahjahanpur", bn: "শাহজাহানপুর", lat: 23.7456, lng: 90.422 },
];

/** Hand-checked centres for the original demo areas (the source's points are ~10 km off for some). */
const COORD_FIX = {
  "noakhali.noakhali-sadar": [22.8696, 91.0995],
  "noakhali.begumganj": [22.9466, 91.1036],
  "noakhali.companiganj": [22.8781, 91.2878],
  "dhaka.mirpur": [23.8223, 90.3654],
  "dhaka.uttara-west": [23.8759, 90.3795],
  "dhaka.mohammadpur": [23.7662, 90.3589],
  "chattogram.kotwali": [22.3369, 91.8346],
  "cumilla.cumilla-sadar": [23.4607, 91.1809],
};

const cleanEn = (s) =>
  s.replace(/\s*\((Dhaka|Chittagong)\)/i, "").replace(/(\s+Thana)+$/i, "").trim();
const cleanBn = (s) => s.replace(/\s*থানা$/, "").trim();

// ---------- coordinates: match names against OpenStreetMap (see fetch-osm-admin.mjs) ----------
const osm = JSON.parse(readFileSync("scripts/data/cache/osm-admin.json", "utf8"));
/** Forgiving Bangla key: drops nukta / hasanta / chandrabindu and merges common spelling variants. */
const normBn = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*(উপজেলা|জেলা|থানা)\s*$/, "")
    .replace(/[়্ঁ‌‍]/g, "")
    .replace(/ী/g, "ি").replace(/ূ/g, "ু").replace(/ং/g, "ঙ").replace(/ণ/g, "ন")
    .replace(/[শষ]/g, "স").replace(/ৎ/g, "ত")
    .replace(/[^ঀ-৿]/g, "");
/** Consonant skeleton of a romanised name: "Begumgonj" and "Begumganj" both -> "bgmgnj". */
const skel = (s) => {
  let t = (s ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\b(subdistrict|district|zila|zilla|upazila|upazilla|thana|model|police station)\b/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f").replace(/z/g, "j").replace(/w/g, "o");
  if (!t) return "";
  t = t[0] + t.slice(1).replace(/[aeiouy]/g, "");
  return t.replace(/(.)\1+/g, "$1");
};
const keysOf = (c) => ({
  bn: new Set([normBn(c.bn), normBn(c.name)].filter(Boolean)),
  sk: new Set([skel(c.en), skel(c.name)].filter(Boolean)),
});
const index = (list) => list.map((c) => ({ ...c, keys: keysOf(c) }));
const OSM_UPAZILAS = index(osm.upazilas);
const OSM_PLACES = index(osm.places);
const OSM_DISTRICTS = index(osm.districts);

function match(pool, bn, en, near, maxKm) {
  // OSM sometimes names the sadar upazila after the district alone ("বগুড়া" for "বগুড়া সদর").
  const nbs = new Set([normBn(bn), normBn(bn.replace(/\s*সদর$/, ""))]);
  const sks = new Set([skel(en), skel(en.replace(/\s*sadar$/i, ""))].filter(Boolean));
  let best = null;
  for (const c of pool) {
    if (![...nbs].some((k) => c.keys.bn.has(k)) && ![...sks].some((k) => c.keys.sk.has(k))) continue;
    const dist = km(c, near);
    if (dist <= maxKm && (!best || dist < best.dist)) best = { lat: round(c.lat), lng: round(c.lng), dist };
  }
  return best;
}

for (const d of districts) {
  const m = match(OSM_DISTRICTS, d.bn, d.en, d, 200);
  if (!m) console.warn(`district not found in OSM: ${d.en}`);
  else if (m.dist > 35) console.warn(`district ${d.en}: source point ${m.dist.toFixed(0)} km from OSM centre`);
}

// Upazila Health Complexes sit in the upazila HQ town: a better "centre" than the middle of a
// boundary box (which can fall in the Sundarbans or the sea for coastal upazilas).
const UHC = existsSync("src/data/hospitals.json")
  ? JSON.parse(readFileSync("src/data/hospitals.json", "utf8"))
      .filter((h) => /upazila health complex|উপজেলা স্বাস্থ্য কমপ্লেক্স/i.test(`${h.name} ${h.nameBn ?? ""}`))
      .map((h) => ({ ...h, sk: skel(h.name.replace(/upazila health complex.*$/i, "")) }))
  : [];
function uhcPoint(en, near) {
  const sk = skel(en.replace(/s*sadar$/i, ""));
  let best = null;
  for (const h of UHC) {
    if (!sk || h.sk !== sk) continue;
    const dist = km(h, near);
    if (dist <= 70 && (!best || dist < best.dist)) best = { lat: round(h.lat), lng: round(h.lng), dist };
  }
  return best;
}

const areas = [];
const seen = new Set();
const stats = { fixed: 0, upazila: 0, place: 0, source: 0, district: 0 };
const push = (a) => {
  if (seen.has(a.id)) return;
  seen.add(a.id);
  areas.push(a);
};

for (const [, , districtId, rawEn, rawBn, lat, lng] of php("ThanaSeeder.php").matchAll(ROW)) {
  const dId = Number(districtId);
  const key = `${dId}:${rawEn}`;
  if (key in AREA_FIX && AREA_FIX[key] === null) continue;
  const fix = AREA_FIX[key] ?? {};
  const d = distById.get(dId);
  if (!d) throw new Error(`unknown district ${dId} for ${rawEn}`);
  const en = fix.en ?? cleanEn(rawEn);
  const bn = fix.bn ?? cleanBn(rawBn);
  const id = `${slug(d.en)}.${slug(en)}`;
  const source = { lat: round(lat), lng: round(lng) };

  let point;
  let approx = false;
  if (COORD_FIX[id]) {
    point = { lat: COORD_FIX[id][0], lng: COORD_FIX[id][1] };
    stats.fixed++;
  } else if ((point = uhcPoint(en, d))) {
    stats.uhc = (stats.uhc ?? 0) + 1;
  } else if ((point = match(OSM_UPAZILAS, bn, en, d, 90))) {
    stats.upazila++;
  } else if ((point = match(OSM_PLACES, bn, en, d, 40))) {
    stats.place++;
  } else if (km(source, d) <= 40) {
    point = source; // unverified, but plausibly inside the district
    approx = true;
    stats.source++;
  } else {
    point = { lat: d.lat, lng: d.lng };
    approx = true;
    stats.district++;
  }
  if (approx) console.warn(`approx ${id} (${stats.district && point.lat === d.lat ? "district centre" : "source point"})`);
  push({ id, d: dId, en, bn, lat: point.lat, lng: point.lng, ...(approx ? { approx: true } : {}) });
}
for (const x of EXTRA) {
  const d = distById.get(x.districtId);
  push({ id: `${slug(d.en)}.${slug(x.en)}`, d: x.districtId, en: x.en, bn: x.bn, lat: x.lat, lng: x.lng });
}

areas.sort((a, b) => a.d - b.d || a.en.localeCompare(b.en));

const missing = Object.keys(COORD_FIX).filter((id) => !seen.has(id));
if (missing.length) throw new Error(`COORD_FIX ids not found: ${missing.join(", ")}`);

const out = {
  source:
    "bd_geo_code (github.com/nuhil/bangladesh-geocode) via rokto backend seeders; cleaned by scripts/data/import-bd-locations.mjs",
  divisions,
  districts,
  areas,
};
writeFileSync("src/data/bd-locations.json", JSON.stringify(out));
console.log(
  `${divisions.length} divisions, ${districts.length} districts, ${areas.length} areas ${JSON.stringify(stats)} -> src/data/bd-locations.json`,
);
