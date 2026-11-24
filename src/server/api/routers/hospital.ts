import { z } from "zod";
import osm from "~/data/hospitals.json";
import manual from "~/data/hospitals-manual.json";
import { DEFAULT_AREA_ID, getArea } from "~/lib/areas";
import { haversineKm } from "~/lib/geo";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export interface Hospital {
  id: string;
  name: string;
  nameBn: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  emergency: boolean;
  dengueCare: boolean;
  /** Hand-entered coordinates that still need checking on a map */
  approx?: boolean;
  isPublic?: boolean;
}

/** Government hospitals in Bangladesh treat dengue and are free; flag them by name. */
const PUBLIC_RE =
  /medical college|upazila health complex|sadar hospital|general hospital|250 bed|mugda|kurmitola|suhrawardy|salimullah|infectious disease|DNCC|government|সরকারি/i;

/** Diagnostic centres / labs are sometimes tagged as hospitals in OSM but cannot admit patients. */
const NOT_INPATIENT_RE = /diagnostic|\blab\b|laboratory|imaging|pathology|\beye\b|dental|ডায়াগনস্টিক/i;

const ALL: Hospital[] = [...(manual as Hospital[]), ...(osm as Hospital[])]
  .filter((h) => !NOT_INPATIENT_RE.test(h.name))
  .map((h) => ({
  ...h,
  isPublic: h.dengueCare || PUBLIC_RE.test(h.name) || PUBLIC_RE.test(h.nameBn ?? ""),
}));

/** Beyond this, warn that the list may be incomplete and push the helplines. */
const FAR_KM = 25;

export const hospitalRouter = createTRPCRouter({
  /** Nearest hospitals to the phone's location, or to the patient's area centre if location is denied. */
  nearest: publicProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        area: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(6),
      }),
    )
    .query(({ input }) => {
      const area = getArea(input.area ?? "") ?? getArea(DEFAULT_AREA_ID)!;
      const origin =
        input.lat != null && input.lng != null
          ? { lat: input.lat, lng: input.lng, source: "gps" as const }
          : { lat: area.lat, lng: area.lng, source: "area" as const };

      // Prefer public / emergency hospitals: treat them as 1.5 km closer when ranking.
      const score = (h: Hospital & { distanceKm: number }) =>
        h.distanceKm - (h.isPublic || h.emergency ? 1.5 : 0);
      const list = ALL.map((h) => ({ ...h, distanceKm: haversineKm(origin, h) }))
        .sort((a, b) => score(a) - score(b))
        .slice(0, input.limit);

      // The map data can be thin in remote upazilas: say so instead of implying the list is complete.
      const nearestKm = list.length ? Math.min(...list.map((h) => h.distanceKm)) : null;
      return { origin, hospitals: list, farAway: nearestKm == null || nearestKm > FAR_KM };
    }),
});
