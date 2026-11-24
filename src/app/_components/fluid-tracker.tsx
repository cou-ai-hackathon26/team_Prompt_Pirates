"use client";

import { CupSoda, Droplets, GlassWater, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toBn } from "~/lib/bn";
import { formatMl } from "~/lib/fluids";
import { api } from "~/trpc/react";

const QUICK = [
  {
    ml: 200,
    kind: "water" as const,
    label: "১ গ্লাস",
    sub: "২০০ মিলি",
    Icon: GlassWater,
  },
  {
    ml: 100,
    kind: "water" as const,
    label: "১ কাপ",
    sub: "১০০ মিলি",
    Icon: CupSoda,
  },
  {
    ml: 500,
    kind: "ors" as const,
    label: "ORS ১ প্যাকেট",
    sub: "৫০০ মিলি",
    Icon: Droplets,
  },
];

function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, pct);
  const color = pct >= 1 ? "#15803d" : pct >= 0.5 ? "#0f766e" : "#dc2626";
  return (
    <svg
      viewBox="0 0 80 80"
      className="size-24 shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="9"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

/**
 * Daily oral-fluid tracker. Fluids are the one thing families can actively do in dengue home care.
 * Intake below half the target by evening in the critical phase raises the status to YELLOW at the next check.
 */
export function FluidTracker({
  patientId,
  critical,
}: {
  patientId: string;
  critical: boolean;
}) {
  const utils = api.useUtils();
  const q = api.fluid.today.useQuery({ patientId });
  const router = useRouter();
  // also refresh server-rendered parts of the page (the "আজকের করণীয়" checklist)
  const refresh = async () => {
    await utils.fluid.today.invalidate({ patientId });
    router.refresh();
  };
  const add = api.fluid.add.useMutation({ onSuccess: refresh });
  const undo = api.fluid.undo.useMutation({ onSuccess: refresh });

  if (q.isLoading)
    return <div className="card h-48 animate-pulse bg-slate-100" />;
  if (!q.data) return null;
  const { totalMl, targetMl, estimatedWeight, logs } = q.data;
  const pct = targetMl ? totalMl / targetMl : 0;
  const total = formatMl(totalMl);
  const target = formatMl(targetMl);
  const left = Math.max(0, targetMl - totalMl);

  return (
    <section
      id="fluids"
      className="card flex scroll-mt-20 flex-col gap-4"
      aria-labelledby="fluid-title"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Ring pct={pct} />
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
            <span className="text-xl font-bold tabular-nums">
              {toBn(Math.round(Math.min(pct, 9.99) * 100))}%
            </span>
          </span>
        </div>
        <div className="min-w-0">
          <h2 id="fluid-title" className="text-lg font-bold">
            আজ তরল খাওয়া
          </h2>
          <p className="text-2xl font-bold tabular-nums">
            {toBn(total.value)} {total.unit}
            <span className="text-base font-normal text-slate-600">
              {" "}
              / {toBn(target.value)} {target.unit}
            </span>
          </p>
          <p
            className={`text-sm ${pct >= 1 ? "font-semibold text-green-700" : "text-slate-600"}`}
          >
            {pct >= 1
              ? "আজকের লক্ষ্য পূরণ হয়েছে, এভাবেই চালিয়ে যান"
              : `আরও ${toBn(Math.ceil(left / 200))} গ্লাস (প্রায় ${toBn(left)} মিলি) দরকার`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUICK.map(({ ml, kind, label, sub, Icon }) => (
          <button
            key={label}
            onClick={() => add.mutate({ patientId, ml, kind })}
            disabled={add.isPending}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-teal-700/30 bg-teal-50 px-2 py-2 font-semibold text-teal-900 transition-colors hover:bg-teal-100 disabled:opacity-60"
            aria-label={`${label} যোগ করুন (${sub})`}
          >
            <Icon className="size-6" aria-hidden />
            <span className="text-sm leading-tight">+ {label}</span>
            <span className="text-xs font-normal text-teal-800">{sub}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-slate-600">
          পানি, ওরস্যালাইন, ডাবের পানি, স্যুপ, ফলের রস সব গোনা হয়।
          {estimatedWeight && " লক্ষ্য বয়স থেকে আনুমানিক; ওজন দিলে আরও সঠিক হবে।"}
          {critical &&
            " ৩য়-৭ম দিনে সন্ধ্যার মধ্যে অর্ধেকের কম খেলে অ্যাপ হলুদ সংকেত দেবে।"}
        </p>
        {logs.length > 0 && (
          <button
            onClick={() => undo.mutate({ patientId })}
            disabled={undo.isPending}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Undo2 className="size-4" aria-hidden /> শেষেরটা বাদ
          </button>
        )}
      </div>
      {(add.error ?? undo.error) && (
        <p className="rounded-xl bg-red-50 p-2 text-sm text-red-700">
          সংরক্ষণ হয়নি, আবার চেষ্টা করুন।
        </p>
      )}
    </section>
  );
}
