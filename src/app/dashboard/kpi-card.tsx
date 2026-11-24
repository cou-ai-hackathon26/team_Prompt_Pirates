import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { toBn } from "~/lib/bn";

type Tone = "slate" | "red" | "yellow" | "green" | "blue";

const TONE: Record<Tone, { value: string; chip: string; stroke: string }> = {
  slate: {
    value: "text-slate-900",
    chip: "bg-slate-100 text-slate-700",
    stroke: "#475569",
  },
  red: {
    value: "text-red-700",
    chip: "bg-red-50 text-red-700",
    stroke: "#dc2626",
  },
  yellow: {
    value: "text-yellow-700",
    chip: "bg-yellow-50 text-yellow-800",
    stroke: "#a16207",
  },
  green: {
    value: "text-green-700",
    chip: "bg-green-50 text-green-700",
    stroke: "#15803d",
  },
  blue: {
    value: "text-blue-700",
    chip: "bg-blue-50 text-blue-700",
    stroke: "#1d4ed8",
  },
};

/** Tiny inline sparkline (no chart library): last N daily values. */
function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  if (data.length < 2) return null;
  const w = 88;
  const h = 28;
  const max = Math.max(1, ...data);
  const pts = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`,
    )
    .join(" ");
  const [lx, ly] = pts.split(" ").at(-1)!.split(",").map(Number) as [
    number,
    number,
  ];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      className="overflow-visible"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r={3} fill={stroke} />
    </svg>
  );
}

/**
 * KPI card: tinted icon, big Bangla number, optional change vs yesterday and 7-day sparkline.
 * (Stat-card pattern seen on 21st.dev; colour is always paired with an icon and text.)
 * For counts of severe patients, "up" is bad, so a rise is shown in red and a fall in green.
 */
export function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
  trend,
  note,
}: {
  label: string;
  value: number;
  tone: Tone;
  icon: LucideIcon;
  /** daily values, oldest first; the last two give the change vs yesterday */
  trend?: number[];
  note?: string;
}) {
  const t = TONE[tone];
  const delta =
    trend && trend.length >= 2 ? trend.at(-1)! - trend.at(-2)! : null;
  return (
    <div className="card flex flex-col gap-2 !p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm leading-tight text-slate-600">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p
          className={`text-4xl leading-none font-bold tabular-nums ${t.value}`}
        >
          {toBn(value)}
        </p>
        {trend && <Sparkline data={trend.slice(-7)} stroke={t.stroke} />}
      </div>
      {delta != null && (
        <p
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            delta > 0
              ? "bg-red-50 text-red-700"
              : delta < 0
                ? "bg-green-50 text-green-700"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {delta > 0 ? (
            <TrendingUp className="size-3.5" aria-hidden />
          ) : delta < 0 ? (
            <TrendingDown className="size-3.5" aria-hidden />
          ) : (
            <Minus className="size-3.5" aria-hidden />
          )}
          {delta === 0
            ? "গতকালের সমান"
            : `গতকালের চেয়ে ${delta > 0 ? "+" : "−"}${toBn(Math.abs(delta))}`}
        </p>
      )}
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
