"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MapPoint } from "~/app/_components/leaflet-map";
import { KpiCard } from "./kpi-card";
import { toBn } from "~/lib/symptom-labels";
import { api } from "~/trpc/react";
import {
  BedDouble,
  CircleCheck,
  Siren,
  TriangleAlert,
  Users,
} from "lucide-react";

const LeafletMap = dynamic(() => import("~/app/_components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] animate-pulse rounded-2xl bg-slate-200" />
  ),
});

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "short",
  });

/** Rows shown in the table before "show all". */
const TABLE_ROWS = 12;

export function DashboardView() {
  // Refresh every 20 s so a new RED check-in during the live demo shows up here.
  const q = api.dashboard.overview.useQuery(undefined, {
    refetchInterval: 20_000,
  });
  const [level, setLevel] = useState<"upazila" | "district">("upazila");
  const [division, setDivision] = useState<number | "all">("all");
  const [showAll, setShowAll] = useState(false);

  const view = useMemo(() => {
    if (!q.data) return null;
    const inDiv = <T extends { divisionId: number }>(r: T) =>
      division === "all" || r.divisionId === division;
    const rows = (level === "upazila" ? q.data.areas : q.data.districts).filter(inDiv);
    // Totals and the 15-day series come from districts (same numbers at either level).
    const scope = q.data.districts.filter(inDiv);
    const totals = scope.reduce(
      (t, a) => ({
        active: t.active + a.active,
        red: t.red + a.current.RED,
        yellow: t.yellow + a.current.YELLOW,
        green: t.green + a.current.GREEN,
        expectedRed48h: t.expectedRed48h + a.expectedRed48h,
      }),
      { active: 0, red: 0, yellow: 0, green: 0, expectedRed48h: 0 },
    );
    const series = q.data.days.map((day, i) => ({
      day,
      red: scope.reduce((s, a) => s + a.series[i]!.red, 0),
      yellow: scope.reduce((s, a) => s + a.series[i]!.yellow, 0),
    }));
    const sorted = [...rows].sort(
      (a, b) =>
        Number(b.spike.isSpike) - Number(a.spike.isSpike) ||
        b.current.RED - a.current.RED ||
        b.current.YELLOW - a.current.YELLOW ||
        b.active - a.active,
    );
    return {
      rows: sorted,
      totals,
      series,
      alerts: q.data.alerts.filter(inDiv),
    };
  }, [q.data, level, division]);

  const points = useMemo<MapPoint[]>(
    () =>
      (view?.rows ?? []).map((a) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        label: `${a.level === "upazila" ? `${a.nameBn}, ${a.districtBn}` : `${a.nameBn} জেলা`}: লাল ${toBn(a.current.RED)}, হলুদ ${toBn(a.current.YELLOW)}${a.spike.isSpike ? " (হঠাৎ বৃদ্ধি)" : ""}`,
        color: a.spike.isSpike
          ? "#dc2626"
          : a.current.RED > 0
            ? "#f97316"
            : a.current.YELLOW > 0
              ? "#eab308"
              : "#16a34a",
        radius: (a.level === "district" ? 10 : 8) + Math.sqrt(a.active) * (a.level === "district" ? 3 : 4),
        fillOpacity: 0.6,
        highlight: a.spike.isSpike,
      })),
    [view],
  );

  if (q.isLoading)
    return <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />;
  if (q.error || !q.data || !view)
    return (
      <p className="rounded-xl bg-red-50 p-4 text-red-700">
        ড্যাশবোর্ড লোড হয়নি: {q.error?.message}
      </p>
    );
  const d = { ...view, generatedAt: q.data.generatedAt };
  const tableRows = showAll ? d.rows : d.rows.slice(0, TABLE_ROWS);
  const levelBn = level === "upazila" ? "উপজেলা / থানা" : "জেলা";

  return (
    <div className="flex flex-col gap-5">
      {d.alerts.length > 0 && (
        <div role="alert" className="card bg-red-700 text-white ring-0">
          {d.alerts.map((a) => (
            <p key={a.id} className="text-lg">
              <span className="font-bold">
                <TriangleAlert
                  className="mr-1 inline size-5 align-[-4px]"
                  aria-hidden
                />
                {a.nameBn}:
              </span>{" "}
              আজ {toBn(a.today)} জন গুরুতর (লাল/হলুদ) রোগী,
              {a.ratio
                ? ` স্বাভাবিকের ${a.ratio.toLocaleString("bn-BD", { maximumFractionDigits: 1 })} গুণ।`
                : " হঠাৎ বৃদ্ধি।"}{" "}
              বেড ও স্যালাইন প্রস্তুত রাখুন।
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="কোন স্তরে দেখবেন"
          className="inline-flex rounded-xl bg-slate-100 p-1"
        >
          {(
            [
              ["upazila", "উপজেলা"],
              ["district", "জেলা"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={level === v}
              onClick={() => setLevel(v)}
              className={`min-h-11 rounded-lg px-4 font-semibold ${level === v ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">বিভাগ</span>
          <select
            value={division}
            onChange={(e) =>
              setDivision(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="input !py-2"
          >
            <option value="all">সারা দেশ</option>
            {q.data.divisions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nameBn}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-slate-500">
          {toBn(d.rows.length)}টি {levelBn}য় রোগী আছে
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="সক্রিয় রোগী (বাসায়)"
          value={d.totals.active}
          tone="slate"
          icon={Users}
        />
        <KpiCard
          label="লাল: এখনই হাসপাতাল"
          value={d.totals.red}
          tone="red"
          icon={Siren}
          trend={d.series.map((s) => s.red)}
        />
        <KpiCard
          label="হলুদ: ডাক্তার দেখাবে"
          value={d.totals.yellow}
          tone="yellow"
          icon={TriangleAlert}
          trend={d.series.map((s) => s.yellow)}
        />
        <KpiCard
          label="সবুজ: বাসায় যত্ন"
          value={d.totals.green}
          tone="green"
          icon={CircleCheck}
        />
        <KpiCard
          label="আগামী ৪৮ ঘণ্টায় সম্ভাব্য ভর্তি*"
          value={d.totals.expectedRed48h}
          tone="blue"
          icon={BedDouble}
          note="বেড ও স্যালাইন প্রস্তুত রাখুন"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card !p-3">
          <h2 className="mb-2 px-2 text-lg font-bold">
            {level === "upazila" ? "উপজেলাভিত্তিক" : "জেলাভিত্তিক"} মানচিত্র
          </h2>
          <LeafletMap points={points} className="h-[420px]" />
          <p className="mt-2 px-2 text-xs text-slate-500">
            বৃত্তের আকার = সক্রিয় রোগী; লাল ঘের = হঠাৎ বৃদ্ধি। শুধু এলাকা ও অবস্থা
            দেখানো হয়, কোনো ব্যক্তিগত তথ্য নয়।
          </p>
        </section>
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">গত ১৫ দিন: গুরুতর রোগী</h2>
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.series.map((s) => ({ ...s, day: fmtDay(s.day) }))}
                margin={{ left: -20, right: 6 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(v) => (v === "red" ? "লাল" : "হলুদ")} />
                <Bar dataKey="yellow" stackId="a" fill="#eab308" />
                <Bar
                  dataKey="red"
                  stackId="a"
                  fill="#dc2626"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-bold">{levelBn} অনুযায়ী</h2>
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-sm text-slate-500">
            <tr>
              <th className="py-2">{level === "upazila" ? "উপজেলা / থানা" : "জেলা"}</th>
              <th>সক্রিয়</th>
              <th className="text-red-700">লাল</th>
              <th className="text-yellow-700">হলুদ</th>
              <th>আজ গুরুতর</th>
              <th>১৪ দিনের গড়</th>
              <th>৪৮ ঘণ্টায় সম্ভাব্য</th>
              <th>অবস্থা</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((a) => (
              <tr
                key={a.id}
                className={`border-t border-slate-100 ${a.spike.isSpike ? "bg-red-50" : ""}`}
              >
                <td className="py-2">
                  <span className="font-semibold">{a.nameBn}</span>
                  {a.level === "upazila" && (
                    <span className="block text-xs text-slate-500">{a.districtBn}</span>
                  )}
                </td>
                <td>{toBn(a.active)}</td>
                <td className="font-bold text-red-700">
                  {toBn(a.current.RED)}
                </td>
                <td className="font-bold text-yellow-700">
                  {toBn(a.current.YELLOW)}
                </td>
                <td>{toBn(a.spike.today)}</td>
                <td>
                  {a.spike.mean.toLocaleString("bn-BD", {
                    maximumFractionDigits: 1,
                  })}
                </td>
                <td>{toBn(a.expectedRed48h)}</td>
                <td>
                  {a.spike.isSpike ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-sm font-bold text-white">
                      <TriangleAlert
                        className="mr-1 inline size-4 align-[-3px]"
                        aria-hidden
                      />
                      হঠাৎ বৃদ্ধি
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">স্বাভাবিক</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.rows.length > TABLE_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="btn-ghost mt-2 min-h-11 text-teal-800"
          >
            {showAll
              ? "কম দেখান"
              : `সব ${toBn(d.rows.length)}টি দেখুন`}
          </button>
        )}
        <p className="mt-3 text-xs text-slate-500">
          * সম্ভাব্য ভর্তি = এখন লাল + জ্বরের ৩-৬ দিনে থাকা হলুদ রোগীর ৩০% (প্রোটোটাইপ
          হিসাব)। হঠাৎ বৃদ্ধি = আজকের গুরুতর রোগী আগের ১৪ দিনের গড়ের চেয়ে ২
          স্ট্যান্ডার্ড ডেভিয়েশন বেশি এবং অন্তত ৩ জন। শেষ হালনাগাদ{" "}
          {new Date(d.generatedAt).toLocaleTimeString("bn-BD")}।
        </p>
      </section>
    </div>
  );
}
