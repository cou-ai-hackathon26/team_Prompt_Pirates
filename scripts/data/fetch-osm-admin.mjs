/**
 * One-time fetch of Bangladesh district / upazila centres and Dhaka + Chattogram neighbourhood
 * points from OpenStreetMap (Overpass API). Used by import-bd-locations.mjs to replace the
 * unreliable upazila coordinates of the source dataset.
 *
 * Run:  node scripts/data/fetch-osm-admin.mjs   -> writes scripts/data/cache/osm-admin.json
 * Data © OpenStreetMap contributors (ODbL).
 */
import { mkdirSync, writeFileSync } from "node:fs";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpass(q) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: q }),
        headers: { "user-agent": "denguesathi-hackathon-prototype" },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).elements;
    } catch (e) {
      console.warn(url, "failed:", e.message);
    }
  }
  throw new Error("all Overpass endpoints failed");
}

const pick = (e, kind) => ({
  kind,
  name: e.tags.name ?? null,
  bn: e.tags["name:bn"] ?? null,
  en: e.tags["name:en"] ?? null,
  lat: Math.round((e.lat ?? e.center.lat) * 1e5) / 1e5,
  lng: Math.round((e.lon ?? e.center.lon) * 1e5) / 1e5,
});

const admin = await overpass(`[out:json][timeout:150];
area["ISO3166-1"="BD"][admin_level=2]->.bd;
relation["boundary"="administrative"]["admin_level"~"^(5|6)$"](area.bd);
out center tags;`);

// Dhaka + Gazipur, and Chattogram city: neighbourhood points for matching city thanas.
const BOXES = ["23.62,90.28,24.15,90.56", "22.18,91.68,22.52,91.95"];
const places = await overpass(`[out:json][timeout:150];
(${BOXES.map((b) => `nwr["place"~"^(suburb|neighbourhood|quarter|town|city)$"](${b});`).join("")});
out center tags;`);

const out = {
  attribution: "© OpenStreetMap contributors (ODbL)",
  districts: admin.filter((e) => e.tags.admin_level === "5").map((e) => pick(e, "district")),
  upazilas: admin.filter((e) => e.tags.admin_level === "6").map((e) => pick(e, "upazila")),
  places: places.filter((e) => e.tags.name).map((e) => pick(e, e.tags.place)),
};
mkdirSync("scripts/data/cache", { recursive: true });
writeFileSync("scripts/data/cache/osm-admin.json", JSON.stringify(out));
console.log(
  `${out.districts.length} districts, ${out.upazilas.length} upazilas, ${out.places.length} places -> scripts/data/cache/osm-admin.json`,
);
