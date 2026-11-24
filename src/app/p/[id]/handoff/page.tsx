import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { symptomsSchema } from "~/lib/ai/schemas";
import { areaNameEn } from "~/lib/areas";
import {
  REASON_EN,
  RISK_FACTOR_EN,
  symptomsEn,
  WHO_RULE_CODES,
} from "~/lib/clinical-labels";
import { fluidTargetMl, startOfDhakaDay } from "~/lib/fluids";
import { dayOfFever, type Reason } from "~/lib/risk/who-rules";
import { db } from "~/server/db";
import { HandoffActions } from "./handoff-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clinical handoff | DengueSathi" };

const STATUS = {
  GREEN: { en: "GREEN · home care", bn: "সবুজ", cls: "bg-risk-green" },
  YELLOW: {
    en: "YELLOW · see a doctor today",
    bn: "হলুদ",
    cls: "bg-risk-yellow",
  },
  RED: {
    en: "RED · warning signs, needs hospital assessment",
    bn: "লাল",
    cls: "bg-risk-red",
  },
} as const;

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });

/** Tiny server-rendered line chart (prints cleanly, no JS). */
function Trend({
  points,
  color,
  unit,
}: {
  points: { label: string; v: number }[];
  color: string;
  unit: string;
}) {
  if (points.length === 0)
    return <p className="text-sm text-slate-600">No results</p>;
  const w = 260;
  const h = 70;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const xy = points.map(
    (p, i) =>
      [
        points.length === 1 ? w / 2 : 32 + (i / (points.length - 1)) * (w - 64),
        18 + (1 - (p.v - min) / span) * (h - 30),
      ] as const,
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 14}`}
      className="w-full"
      role="img"
      aria-label={`${points.map((p) => `${p.label}: ${p.v}${unit}`).join(", ")}`}
    >
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
      />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3.5} fill={color} />
          <text
            x={x}
            y={y - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#0f172a"
            fontWeight={600}
          >
            {points[i]!.v.toLocaleString("en-IN")}
          </text>
          <text
            x={x}
            y={h + 10}
            textAnchor="middle"
            fontSize="8"
            fill="#475569"
          >
            {points[i]!.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const RESOLUTION_EN: Record<string, string> = {
  CONFIRMED_SAME: "family confirmed it is this patient",
  REJECTED_OTHER: "family said another person; not used",
  NOTED: "noted",
};

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      checkIns: { orderBy: { createdAt: "asc" } },
      labs: { where: { confirmed: true }, orderBy: { takenAt: "asc" } },
      assessments: { orderBy: { createdAt: "desc" }, take: 1 },
      fluids: {
        where: { createdAt: { gte: new Date(Date.now() - 2 * 864e5) } },
        select: { ml: true, createdAt: true },
      },
      conflicts: {
        where: { createdAt: { gte: new Date(Date.now() - 14 * 864e5) } },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
  if (!patient) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/p/${id}/handoff`;
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  const now = new Date();
  const day = dayOfFever(patient.feverStart, now);
  const latest = patient.assessments[0];
  const reasons = (latest?.reasons ?? []) as unknown as Reason[];
  const baseHct = patient.labs.find((l) => l.hctPct != null)?.hctPct ?? null;
  const labDay = (d: Date) => `D${dayOfFever(patient.feverStart, d)}`;
  const todayStart = startOfDhakaDay(now);
  const yStart = new Date(todayStart.getTime() - 864e5);
  const fluidToday = patient.fluids
    .filter((f) => f.createdAt >= todayStart)
    .reduce((s, f) => s + f.ml, 0);
  const fluidYesterday = patient.fluids
    .filter((f) => f.createdAt >= yStart && f.createdAt < todayStart)
    .reduce((s, f) => s + f.ml, 0);
  const fluidTarget = fluidTargetMl(patient.ageYears, patient.weightKg).ml;
  const risk = [
    ...patient.riskFactors.map((r) => RISK_FACTOR_EN[r] ?? r),
    ...(patient.ageYears < 1 ? ["Infant"] : []),
    ...(patient.ageYears >= 65 ? ["Elderly"] : []),
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 print:max-w-none print:p-0 print:text-[12px]">
      <HandoffActions patientId={id} url={url} />

      <article className="card flex flex-col gap-4 print:p-0 print:shadow-none print:ring-0">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
              DengueSathi · home monitoring summary
            </p>
            <h1 className="text-2xl font-bold">Dengue clinical handoff</h1>
            <p className="text-sm text-slate-700">
              ডাক্তারের জন্য সারাংশ · Generated {fmt(now)} (Dhaka)
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="size-24"
              aria-label="QR code linking to this summary"
              role="img"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span className="text-[10px] text-slate-600">
              Scan for live record
            </span>
          </div>
        </header>

        {/* Patient + status */}
        <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold">Patient</dt>
            <dd>
              {patient.nickname} · {patient.ageYears} y
              {patient.sex
                ? ` · ${patient.sex === "male" ? "M" : patient.sex === "female" ? "F" : patient.sex}`
                : ""}
              {patient.weightKg ? ` · ${patient.weightKg} kg` : ""}
            </dd>
            <dt className="font-semibold">Area</dt>
            <dd>{areaNameEn(patient.area)}</dd>
            <dt className="font-semibold">Fever onset</dt>
            <dd>
              {fmt(patient.feverStart)} → <b>today = fever day {day}</b>
              {day >= 3 && day <= 7 && (
                <span className="ml-1 font-bold text-red-700">
                  (critical phase)
                </span>
              )}
            </dd>
            <dt className="font-semibold">Oral fluids</dt>
            <dd>
              {patient.fluids.length === 0 ? (
                "Not logged"
              ) : (
                <>
                  Today {fluidToday} ml · yesterday {fluidYesterday} ml{" "}
                  <span className="text-slate-600">
                    (home target ~{fluidTarget} ml/day)
                  </span>
                </>
              )}
            </dd>
            <dt className="font-semibold">Risk factors</dt>
            <dd>{risk.length ? risk.join(", ") : "None reported"}</dd>
          </dl>
          {latest && (
            <div
              className={`self-start rounded-xl px-4 py-3 text-white ${STATUS[latest.status].cls}`}
            >
              <p className="text-xs opacity-90">Current home triage</p>
              <p className="text-lg leading-tight font-bold">
                {STATUS[latest.status].en}
              </p>
              <p className="text-xs opacity-90">at {fmt(latest.createdAt)}</p>
            </div>
          )}
        </section>

        {reasons.length > 0 && (
          <section>
            <h2 className="mb-1 font-bold">Why flagged</h2>
            <ul className="list-disc pl-5 text-sm">
              {reasons.map((r, i) => (
                <li key={i}>
                  {r.source === "ai" ? (
                    <>
                      <b>AI trend:</b> {r.textBn}
                    </>
                  ) : (
                    (REASON_EN[r.code] ?? r.textBn)
                  )}
                  <span className="ml-1 text-xs text-slate-600">
                    [
                    {r.source === "ai"
                      ? "AI"
                      : WHO_RULE_CODES.has(r.code)
                        ? "WHO 2009"
                        : "app rule"}
                    ]
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {patient.conflicts.length > 0 && (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 print:bg-white">
            <h2 className="mb-1 font-bold">Data conflicts</h2>
            <ul className="list-disc pl-5 text-sm">
              {patient.conflicts.map((c) => (
                <li key={c.id}>
                  {c.textEn}{" "}
                  <span className="text-xs text-slate-600">
                    [{c.source.toLowerCase()},{" "}
                    {c.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" })}:{" "}
                    {RESOLUTION_EN[c.resolution] ?? c.resolution}]
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Labs */}
        <section>
          <h2 className="mb-1 font-bold">Laboratory trend (CBC)</h2>
          {patient.labs.length === 0 ? (
            <p className="text-sm text-slate-600">No CBC results recorded.</p>
          ) : (
            <>
              <table className="w-full border-collapse text-sm [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top [&_th]:py-1.5 [&_th]:pr-4 [&_th]:whitespace-nowrap">
                <thead className="border-b border-slate-300 text-left">
                  <tr>
                    <th>Date</th>
                    <th>Fever day</th>
                    <th>Platelets /µL</th>
                    <th>HCT %</th>
                    <th>Δ HCT vs first</th>
                    <th>WBC /µL</th>
                    <th>Hb g/dL</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.labs.map((l) => {
                    const dh =
                      baseHct != null && l.hctPct != null
                        ? ((l.hctPct - baseHct) / baseHct) * 100
                        : null;
                    return (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="whitespace-nowrap">{fmt(l.takenAt)}</td>
                        <td className="whitespace-nowrap">
                          {labDay(l.takenAt)}
                        </td>
                        <td
                          className={
                            l.plateletUl != null && l.plateletUl < 100_000
                              ? "font-bold text-red-700"
                              : ""
                          }
                        >
                          {l.plateletUl?.toLocaleString("en-IN") ?? "-"}
                        </td>
                        <td>{l.hctPct ?? "-"}</td>
                        <td
                          className={
                            dh != null && dh >= 20
                              ? "font-bold text-red-700"
                              : ""
                          }
                        >
                          {dh != null
                            ? `${dh >= 0 ? "+" : ""}${dh.toFixed(0)}%`
                            : "-"}
                        </td>
                        <td>{l.wbcUl?.toLocaleString("en-IN") ?? "-"}</td>
                        <td>{l.hbGdl ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-red-700">
                    Platelets (/µL)
                  </p>
                  <Trend
                    color="#dc2626"
                    unit="/µL"
                    points={patient.labs
                      .filter((l) => l.plateletUl != null)
                      .map((l) => ({
                        label: labDay(l.takenAt),
                        v: l.plateletUl!,
                      }))}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-700">
                    Haematocrit (%)
                  </p>
                  <Trend
                    color="#1d4ed8"
                    unit="%"
                    points={patient.labs
                      .filter((l) => l.hctPct != null)
                      .map((l) => ({ label: labDay(l.takenAt), v: l.hctPct! }))}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Symptom timeline */}
        <section>
          <h2 className="mb-1 font-bold">
            Home symptom log (caregiver-reported)
          </h2>
          {patient.checkIns.length === 0 ? (
            <p className="text-sm text-slate-600">No check-ins recorded.</p>
          ) : (
            <table className="w-full border-collapse text-sm [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top [&_th]:py-1.5 [&_th]:pr-4 [&_th]:whitespace-nowrap">
              <thead className="border-b border-slate-300 text-left">
                <tr>
                  <th>When</th>
                  <th>Day</th>
                  <th className="w-full">Reported</th>
                </tr>
              </thead>
              <tbody>
                {patient.checkIns.map((c) => {
                  const p = symptomsSchema.safeParse(c.symptoms);
                  const items = p.success ? symptomsEn(p.data) : [];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="whitespace-nowrap">{fmt(c.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        D{dayOfFever(patient.feverStart, c.createdAt)}
                      </td>
                      <td>
                        {items.length === 0 ? (
                          <span className="text-slate-600">
                            No warning signs reported
                          </span>
                        ) : (
                          items.map((it, i) => (
                            <span
                              key={i}
                              className={
                                it.warning ? "font-bold text-red-700" : ""
                              }
                            >
                              {i > 0 ? "; " : ""}
                              {it.text}
                            </span>
                          ))
                        )}
                        {c.transcript && (
                          <span className="block text-xs text-slate-600 italic">
                            Caregiver (Bangla): “{c.transcript}”
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer className="border-t border-slate-300 pt-2 text-[11px] leading-snug text-slate-600">
          Caregiver-reported home monitoring data collected with DengueSathi.
          Lab values were read from report photos by AI and confirmed by the
          caregiver; verify against the original report. Triage follows WHO 2009
          dengue warning signs; this is not a diagnosis. পরিবারের দেওয়া তথ্য,
          চূড়ান্ত সিদ্ধান্ত চিকিৎসকের।
        </footer>
      </article>
      <p className="text-center text-sm text-slate-600 print:hidden">
        এই পাতাটি জরুরি বিভাগে ডাক্তারকে দেখান, অথবা প্রিন্ট করে সাথে নিন। ডাক্তার QR
        স্ক্যান করে সর্বশেষ তথ্য দেখতে পারবেন।
      </p>
    </main>
  );
}
