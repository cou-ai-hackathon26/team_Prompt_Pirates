"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface LabPoint {
  takenAt: string | Date;
  plateletUl: number | null;
  hctPct: number | null;
}

const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "short" });

/** Platelets (thousands) and haematocrit on separate small charts: easier to read than a dual axis. */
export function TrendChart({ labs }: { labs: LabPoint[] }) {
  const data = labs.map((l) => ({
    day: fmtDay(l.takenAt),
    plt: l.plateletUl != null ? Math.round(l.plateletUl / 1000) : null,
    hct: l.hctPct,
  }));

  if (data.length === 0)
    return <p className="text-slate-500">এখনও কোনো রক্ত পরীক্ষার ফল নেই। CBC রিপোর্টের ছবি দিলে এখানে ট্রেন্ড দেখা যাবে।</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MiniChart title="প্লাটিলেট (হাজার)" dataKey="plt" color="#dc2626" data={data} refs={[{ y: 100, label: "১ লাখ" }, { y: 50, label: "৫০ হাজার" }]} />
      <MiniChart title="হেমাটোক্রিট (HCT %)" dataKey="hct" color="#2563eb" data={data} refs={[]} />
    </div>
  );
}

function MiniChart({
  title,
  dataKey,
  color,
  data,
  refs,
}: {
  title: string;
  dataKey: "plt" | "hct";
  color: string;
  data: { day: string; plt: number | null; hct: number | null }[];
  refs: { y: number; label: string }[];
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold" style={{ color }}>
        {title}
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={dataKey === "plt" ? [0, "auto"] : ["dataMin - 4", "dataMax + 4"]} />
            <Tooltip formatter={(v) => (dataKey === "plt" ? `${String(v)} হাজার` : `${String(v)}%`)} />
            {refs.map((r) => (
              <ReferenceLine key={r.y} y={r.y} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: r.label, fontSize: 10, fill: "#b45309", position: "insideTopRight" }} />
            ))}
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 5 }} connectNulls isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
