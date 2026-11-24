import { detectSpike, dhakaDay, fillDays, lastNDays, type SpikeResult } from "~/lib/anomaly";
import { getArea, getDistrict, getDivision, resolveAreaId } from "~/lib/areas";
import { createTRPCRouter, staffProcedure } from "~/server/api/trpc";

type Status = "GREEN" | "YELLOW" | "RED";
const RANK: Record<Status, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

/** Patients whose fever started within this many days count as "active". */
const ACTIVE_DAYS = 10;
/** PROTOTYPE heuristic: share of YELLOW patients in fever day 3-6 expected to turn RED within 48 h. */
const YELLOW_TO_RED_48H = 0.3;

export interface RegionRow {
  id: string;
  level: "upazila" | "district";
  nameBn: string;
  districtId: number;
  districtBn: string;
  divisionId: number;
  lat: number;
  lng: number;
  active: number;
  current: Record<Status, number>;
  yellowCritical: number;
  expectedRed48h: number;
  spike: SpikeResult;
  series: { day: string; red: number; yellow: number }[];
}

const severe = (series: RegionRow["series"]) =>
  series.map((s) => ({ day: s.day, count: s.red + s.yellow }));

export const dashboardRouter = createTRPCRouter({
  /**
   * Overview for hospitals / upazila health offices, for all of Bangladesh. Anonymised: only area + status.
   * Only areas with patients are returned. Daily count = distinct patients whose worst status that
   * day was YELLOW or RED. Spikes are checked per upazila and per district (a district can spike
   * from several upazilas that are each too small to flag on their own).
   */
  overview: staffProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const days = lastNDays(15, now);
    const since = new Date(now.getTime() - 15 * 864e5);

    const [assessments, patients] = await Promise.all([
      ctx.db.riskAssessment.findMany({
        where: { createdAt: { gte: since } },
        select: { patientId: true, status: true, createdAt: true, patient: { select: { area: true } } },
      }),
      ctx.db.patient.findMany({
        where: { feverStart: { gte: new Date(now.getTime() - ACTIVE_DAYS * 864e5) } },
        select: {
          id: true,
          area: true,
          feverStart: true,
          assessments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        },
      }),
    ]);

    // worst status per (area, day, patient)
    const worst = new Map<string, Status>();
    for (const a of assessments) {
      const key = `${resolveAreaId(a.patient.area)}|${dhakaDay(a.createdAt)}|${a.patientId}`;
      const cur = worst.get(key);
      if (!cur || RANK[a.status] > RANK[cur]) worst.set(key, a.status);
    }
    const daily = new Map<string, { red: Map<string, number>; yellow: Map<string, number> }>();
    for (const [key, status] of worst) {
      if (status === "GREEN") continue;
      const [area, day] = key.split("|") as [string, string];
      const d = daily.get(area) ?? { red: new Map(), yellow: new Map() };
      const m = status === "RED" ? d.red : d.yellow;
      m.set(day, (m.get(day) ?? 0) + 1);
      daily.set(area, d);
    }

    const activeByArea = new Map<string, typeof patients>();
    for (const p of patients) {
      const id = resolveAreaId(p.area);
      activeByArea.set(id, [...(activeByArea.get(id) ?? []), p]);
    }

    const areaIds = new Set([...activeByArea.keys(), ...daily.keys()]);
    const areas: RegionRow[] = [];
    for (const id of areaIds) {
      const area = getArea(id);
      const district = area && getDistrict(area.d);
      if (!area || !district) continue; // unknown legacy value
      const active = activeByArea.get(id) ?? [];
      const current = { GREEN: 0, YELLOW: 0, RED: 0 } as Record<Status, number>;
      let yellowCritical = 0;
      for (const p of active) {
        const s = p.assessments[0]?.status ?? "GREEN";
        current[s]++;
        const day = Math.floor((now.getTime() - p.feverStart.getTime()) / 864e5) + 1;
        if (s === "YELLOW" && day >= 3 && day <= 6) yellowCritical++;
      }
      const d = daily.get(id);
      const red = fillDays(d?.red ?? new Map<string, number>(), days);
      const yellow = fillDays(d?.yellow ?? new Map<string, number>(), days);
      const series = days.map((day, i) => ({ day, red: red[i]!.count, yellow: yellow[i]!.count }));
      areas.push({
        id,
        level: "upazila",
        nameBn: area.bn,
        districtId: district.id,
        districtBn: district.bn,
        divisionId: district.divisionId,
        lat: area.lat,
        lng: area.lng,
        active: active.length,
        current,
        yellowCritical,
        expectedRed48h: Math.round(yellowCritical * YELLOW_TO_RED_48H + current.RED),
        spike: detectSpike(severe(series)),
        series,
      });
    }

    // Roll up to districts.
    const byDistrict = new Map<number, RegionRow[]>();
    for (const a of areas) byDistrict.set(a.districtId, [...(byDistrict.get(a.districtId) ?? []), a]);
    const districts: RegionRow[] = [...byDistrict.entries()].map(([districtId, rows]) => {
      const district = getDistrict(districtId)!;
      const current = { GREEN: 0, YELLOW: 0, RED: 0 } as Record<Status, number>;
      let active = 0;
      let yellowCritical = 0;
      for (const r of rows) {
        active += r.active;
        yellowCritical += r.yellowCritical;
        for (const s of ["GREEN", "YELLOW", "RED"] as const) current[s] += r.current[s];
      }
      const series = days.map((day, i) => ({
        day,
        red: rows.reduce((s, r) => s + r.series[i]!.red, 0),
        yellow: rows.reduce((s, r) => s + r.series[i]!.yellow, 0),
      }));
      return {
        id: `district-${districtId}`,
        level: "district",
        nameBn: district.bn,
        districtId,
        districtBn: district.bn,
        divisionId: district.divisionId,
        lat: district.lat,
        lng: district.lng,
        active,
        current,
        yellowCritical,
        expectedRed48h: Math.round(yellowCritical * YELLOW_TO_RED_48H + current.RED),
        spike: detectSpike(severe(series)),
        series,
      };
    });

    const divisionIds = [...new Set(districts.map((d) => d.divisionId))].sort((a, b) => a - b);
    const divisions = divisionIds.map((id) => ({ id, nameBn: getDivision(id)?.bn ?? String(id) }));

    // Upazila alerts first; a district alert only when none of its upazilas already raised one.
    const alertedDistricts = new Set(areas.filter((a) => a.spike.isSpike).map((a) => a.districtId));
    const alerts = [
      ...areas.filter((a) => a.spike.isSpike),
      ...districts.filter((d) => d.spike.isSpike && !alertedDistricts.has(d.districtId)),
    ].map((r) => ({
      id: r.id,
      level: r.level,
      nameBn: r.level === "upazila" ? `${r.nameBn}, ${r.districtBn}` : `${r.nameBn} জেলা`,
      divisionId: r.divisionId,
      today: r.spike.today,
      ratio: r.spike.ratio,
      z: r.spike.z,
    }));

    return { generatedAt: now, days, areas, districts, divisions, alerts };
  }),
});
