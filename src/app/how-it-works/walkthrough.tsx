"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusCard } from "~/app/_components/status-card";
import type { Reason } from "~/lib/risk/who-rules";
import {
  Camera,
  Check,
  FlaskConical,
  Mic,
  Navigation,
  Pause,
  Phone,
  Play,
  ScanLine,
  SkipBack,
  SkipForward,
  Square,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";

/* ------------------------------------------------------------------ *
 * Auto-playing walkthrough ("video") built from live components, so it
 * always matches the real app and needs no video editing.
 * ------------------------------------------------------------------ */

interface Scene {
  title: string;
  caption: string;
  ms: number;
  render: (t: number) => React.ReactNode; // t = 0..1 progress inside the scene
}

const type = (text: string, t: number, start = 0, end = 0.8) =>
  text.slice(
    0,
    Math.round(
      text.length * Math.min(1, Math.max(0, (t - start) / (end - start))),
    ),
  );
const after = (t: number, at: number) => t >= at;

const RED_REASONS: Reason[] = [
  {
    source: "rule",
    code: "SEVERE_ABDOMINAL_PAIN",
    textBn: "পেটে তীব্র ব্যথা",
    level: "RED",
  },
  {
    source: "rule",
    code: "PLATELET_VERY_LOW",
    textBn: "প্লাটিলেট খুব কম (৪৫,০০০)",
    level: "RED",
  },
  {
    source: "rule",
    code: "HCT_RISE_HIGH",
    textBn: "হেমাটোক্রিট শুরুর তুলনায় ২১% বেড়েছে",
    level: "RED",
  },
  {
    source: "ai",
    code: "AI_TREND",
    textBn: "২ দিনে প্লাটিলেট ১,৬০,০০০ থেকে ৪৫,০০০ এ নেমেছে",
    level: "RED",
  },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
        {value}
        <span className="animate-pulse">|</span>
      </div>
    </div>
  );
}

function Chip({
  text,
  danger,
  show,
}: {
  text: string;
  danger?: boolean;
  show: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-500 ${show ? "scale-100 opacity-100" : "scale-75 opacity-0"} ${
        danger ? "bg-red-600 text-white" : "bg-teal-700 text-white"
      }`}
    >
      <Check className="mr-1 inline size-4 align-[-3px]" aria-hidden />
      {text}
    </span>
  );
}

const SCENES: Scene[] = [
  {
    title: "১. রোগী যোগ করুন",
    caption:
      "পরিবারের যে কেউ ১ মিনিটে রোগী যোগ করেন: নাম, বয়স, এলাকা আর জ্বর কবে শুরু। কোনো লগইন লাগে না।",
    ms: 5000,
    render: (t) => (
      <div className="flex flex-col gap-2.5 p-4">
        <p className="text-lg font-bold">নতুন রোগী</p>
        <Field label="নাম" value={type("রহিম", t, 0, 0.2)} />
        <Field label="বয়স" value={type("৯", t, 0.2, 0.3)} />
        <Field label="এলাকা" value={type("সোনাপুর", t, 0.3, 0.5)} />
        <Field
          label="জ্বর শুরু"
          value={type("৩ দিন আগে (আজ ৪র্থ দিন)", t, 0.5, 0.75)}
        />
        <div
          className={`mt-2 rounded-xl bg-teal-700 py-2.5 text-center font-bold text-white transition ${after(t, 0.85) ? "scale-95 bg-teal-900" : ""}`}
        >
          শুরু করুন →
        </div>
      </div>
    ),
  },
  {
    title: "২. বাংলায় কথা বলে আপডেট",
    caption:
      "প্রতিদিন মাইক চেপে রোগীর অবস্থা নিজের ভাষায় বলুন। পড়তে-লিখতে না পারলেও চলবে।",
    ms: 6500,
    render: (t) => (
      <div className="flex flex-col items-center gap-4 p-5 text-center">
        <p className="text-sm text-slate-600">
          জ্বরের ৪ নম্বর দিন। রোগী আজ কেমন আছে?
        </p>
        <div
          className={`relative flex h-28 w-28 items-center justify-center rounded-full text-5xl text-white shadow-xl ${after(t, 0.1) ? "bg-red-600" : "bg-teal-700"}`}
        >
          {after(t, 0.1) && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
          )}
          <span className="relative">
            {after(t, 0.1) ? (
              <Square className="size-10 fill-current" aria-hidden />
            ) : (
              <Mic className="size-12" aria-hidden />
            )}
          </span>
        </div>
        <div className="flex h-10 items-end gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-red-500"
              style={{
                height: "100%",
                animation: after(t, 0.1)
                  ? `wave ${0.6 + (i % 4) * 0.15}s ${i * 0.05}s ease-in-out infinite`
                  : "none",
                transform: "scaleY(0.2)",
              }}
            />
          ))}
        </div>
        <p className="min-h-16 rounded-xl bg-slate-100 p-3 text-base italic">
          &ldquo;
          {type(
            "জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে",
            t,
            0.15,
            0.9,
          )}
          &rdquo;
        </p>
      </div>
    ),
  },
  {
    title: "৩. AI উপসর্গ বুঝে নেয়",
    caption:
      "AI (Gemini) কথ্য বাংলা থেকে উপসর্গ বের করে। পরিবার এক নজরে মিলিয়ে নিশ্চিত করে।",
    ms: 5000,
    render: (t) => (
      <div className="flex flex-col gap-3 p-4">
        <div className="rounded-xl bg-teal-50 p-3 text-sm">
          <p className="font-semibold text-teal-800">
            <Mic className="inline size-4 align-[-2px]" aria-hidden /> AI যা
            শুনেছে
          </p>
          <p className="italic">
            &ldquo;জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে&rdquo;
          </p>
        </div>
        <p className="font-bold">ঠিক আছে কিনা মিলিয়ে নিন</p>
        <div className="flex flex-wrap gap-2">
          <Chip text="জ্বর হঠাৎ কমেছে" show={after(t, 0.15)} />
          <Chip text="পেটব্যথা: তীব্র" danger show={after(t, 0.35)} />
          <Chip text="বমি ২ বার" show={after(t, 0.55)} />
          <Chip text="পানি খেতে পারছে" show={after(t, 0.7)} />
        </div>
        <div
          className={`mt-2 rounded-xl py-2.5 text-center font-bold text-white transition ${after(t, 0.85) ? "scale-95 bg-teal-900" : "bg-teal-700"}`}
        >
          নিশ্চিত করুন
        </div>
      </div>
    ),
  },
  {
    title: "৪. রক্ত পরীক্ষার রিপোর্ট আছে?",
    caption: "অ্যাপ জিজ্ঞেস করে CBC রিপোর্ট আছে কিনা। থাকলে শুধু ছবি তুললেই হয়।",
    ms: 4000,
    render: (t) => (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <FlaskConical className="size-10" aria-hidden />
        </span>
        <p className="text-xl font-bold">আজ কি CBC রিপোর্ট আছে?</p>
        <div
          className={`w-full rounded-xl py-3 font-bold text-white transition ${after(t, 0.6) ? "scale-95 bg-teal-900 ring-4 ring-teal-300" : "bg-teal-700"}`}
        >
          <Camera className="mr-1 inline size-5 align-[-4px]" aria-hidden />
          হ্যাঁ, ছবি তুলি
        </div>
        <div className="w-full rounded-xl border-2 border-teal-700 py-3 font-bold text-teal-800">
          না, পরে দেব
        </div>
      </div>
    ),
  },
  {
    title: "৫. AI রিপোর্ট পড়ে",
    caption:
      "ছবি থেকে AI প্লাটিলেট, হেমাটোক্রিট (HCT), WBC পড়ে নেয়। একক (লাখ, K/µL, x10⁹/L) কোড নিজেই রূপান্তর করে, অসম্ভব সংখ্যা বাতিল করে।",
    ms: 6500,
    render: (t) => (
      <div className="flex flex-col gap-3 p-3">
        <div className="relative h-44 overflow-hidden rounded-xl bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/samples/cbc/demo-day4-shapla-photo.png"
            alt="নমুনা CBC রিপোর্ট"
            className="h-full w-full object-cover object-top"
          />
          {!after(t, 0.5) && (
            <div
              className="absolute inset-x-0 h-1 bg-teal-400 shadow-[0_0_20px_6px_rgba(45,212,191,.7)]"
              style={{ top: `${(t / 0.5) * 100}%` }}
            />
          )}
          {!after(t, 0.5) && (
            <p className="absolute inset-x-0 bottom-2 text-center text-sm font-bold text-white drop-shadow">
              <ScanLine
                className="mr-1 inline size-4 align-[-3px]"
                aria-hidden
              />
              AI রিপোর্ট পড়ছে...
            </p>
          )}
        </div>
        <div
          className={`flex flex-col gap-1.5 transition-all duration-500 ${after(t, 0.5) ? "opacity-100" : "translate-y-3 opacity-0"}`}
        >
          {[
            ["প্লাটিলেট", "৪৫,০০০ /µL", true],
            ["হেমাটোক্রিট", "৪৬% (↑ ২১%)", true],
            ["WBC", "৩,১০০ /µL", false],
          ].map(([k, v, bad]) => (
            <div
              key={k as string}
              className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span>{k}</span>
              <span className={`font-bold ${bad ? "text-red-600" : ""}`}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "৬. সবুজ / হলুদ / লাল সংকেত",
    caption:
      "WHO-র ডেঙ্গু সতর্কসংকেত নিয়ম আগে চলে; AI শুধু ঝুঁকি বাড়াতে পারে, কমাতে পারে না। লাল হলে বাংলায় শুনিয়ে দেয়।",
    ms: 7000,
    render: (t) => (
      <div className="p-3">
        {after(t, 0.25) ? (
          <div className="fade-up">
            <StatusCard
              status="RED"
              adviceBn="এখনই রোগীকে নিকটস্থ হাসপাতালে নিয়ে যান, দেরি করবেন না।"
              reasons={RED_REASONS}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700" />
            <p className="font-bold">ঝুঁকি যাচাই হচ্ছে...</p>
          </div>
        )}
      </div>
    ),
  },
  {
    title: "৭. নিকটস্থ হাসপাতাল",
    caption: "লাল সংকেতে কাছের সরকারি হাসপাতাল, দূরত্ব, পথনির্দেশ আর ৯৯৯ কল বাটন।",
    ms: 5000,
    render: (t) => (
      <div className="flex flex-col gap-2 p-3">
        <div className="relative h-36 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#e2f0e8,#d6e6f5)]">
          <div className="absolute top-[55%] left-[30%] h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow" />
          {[
            [62, 30],
            [48, 70],
            [20, 60],
          ].map(([x, y], i) => (
            <div
              key={i}
              className={`absolute h-5 w-5 rounded-full border-2 border-white bg-red-600 shadow transition-all duration-500 ${after(t, 0.15 + i * 0.15) ? "scale-100" : "scale-0"}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}
          <svg className="absolute inset-0 h-full w-full">
            <line
              x1="32%"
              y1="58%"
              x2="63%"
              y2="33%"
              stroke="#dc2626"
              strokeWidth="3"
              strokeDasharray="6 5"
              opacity={after(t, 0.6) ? 1 : 0}
            />
          </svg>
        </div>
        {[
          ["নোয়াখালী ২৫০ শয্যা জেনারেল হাসপাতাল", "৩.২ কিমি"],
          ["আব্দুল মালেক উকিল মেডিকেল কলেজ হাসপাতাল", "৪.১ কিমি"],
        ].map(([n, d], i) => (
          <div
            key={n}
            className={`rounded-xl bg-white p-2.5 text-sm shadow-sm ring-1 ring-slate-200 ${i === 0 ? "ring-2 ring-red-500" : ""}`}
          >
            <p className="font-bold">{n}</p>
            <p className="text-slate-500">{d} · সরকারি · জরুরি বিভাগ</p>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-teal-700 py-2 text-center text-sm font-bold text-white">
            <Navigation
              className="mr-1 inline size-4 align-[-3px]"
              aria-hidden
            />
            পথ দেখুন
          </div>
          <div className="rounded-xl bg-red-600 py-2 text-center text-sm font-bold text-white">
            <Phone className="mr-1 inline size-4 align-[-3px]" aria-hidden />
            ৯৯৯
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "৮. হাসপাতাল আগেই জানে",
    caption:
      "বেনামি এলাকাভিত্তিক ড্যাশবোর্ড: কোন এলাকায় হঠাৎ গুরুতর রোগী বাড়ছে, ৪৮ ঘণ্টা আগেই বেড ও স্যালাইন প্রস্তুত রাখা যায়।",
    ms: 6000,
    render: (t) => (
      <div className="flex flex-col gap-3 p-3">
        <div
          className={`rounded-xl bg-red-600 p-3 text-sm text-white transition-all duration-500 ${after(t, 0.55) ? "opacity-100" : "opacity-0"}`}
        >
          <b>
            <TriangleAlert
              className="mr-1 inline size-4 align-[-3px]"
              aria-hidden
            />
            সোনাপুর:
          </b>{" "}
          আজ ৯ জন গুরুতর রোগী, স্বাভাবিকের ৫ গুণ। বেড প্রস্তুত রাখুন।
        </div>
        <div className="flex h-36 items-end gap-1.5 rounded-xl bg-slate-50 p-2">
          {[2, 1, 3, 2, 2, 1, 3, 2, 2, 3, 6, 8, 9].map((v, i, arr) => (
            <div
              key={i}
              className="flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
            >
              <div
                className={`rounded-t ${i >= arr.length - 3 ? "bg-red-600" : "bg-yellow-500"}`}
                style={{
                  height: `${Math.min(1, t * 1.6) * (v / 9) * 100}%`,
                  transition: "height 300ms",
                }}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <b className="block text-xl text-red-600">১২</b>লাল
          </div>
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <b className="block text-xl text-yellow-600">৩১</b>হলুদ
          </div>
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <b className="block text-xl text-blue-700">১৮</b>৪৮ ঘণ্টায় ভর্তি
          </div>
        </div>
      </div>
    ),
  },
];

const TOTAL = SCENES.reduce((s, x) => s + x.ms, 0);

export function Walkthrough() {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  // setInterval (not requestAnimationFrame): rAF pauses when the window is unfocused/hidden,
  // which would freeze the walkthrough on a presentation screen.
  useEffect(() => {
    last.current = performance.now();
    if (!playing) return;
    const id = setInterval(() => {
      const now = performance.now();
      // cap dt so a throttled background tab does not skip whole scenes
      elapsedRef.current += Math.min(250, now - (last.current ?? now));
      last.current = now;
      if (elapsedRef.current >= SCENES[i]!.ms) {
        clearInterval(id);
        if (i < SCENES.length - 1) {
          elapsedRef.current = 0;
          setElapsed(0);
          setI(i + 1); // effect re-runs for the next scene
        } else {
          elapsedRef.current = SCENES[i]!.ms;
          setElapsed(elapsedRef.current);
          setPlaying(false);
        }
        return;
      }
      setElapsed(elapsedRef.current);
    }, 40);
    return () => clearInterval(id);
  }, [playing, i]);

  const go = (n: number) => {
    elapsedRef.current = 0;
    setElapsed(0);
    setI(Math.max(0, Math.min(SCENES.length - 1, n)));
  };
  const scene = SCENES[i]!;
  const t = Math.min(1, elapsed / scene.ms);
  const overall =
    (SCENES.slice(0, i).reduce((s, x) => s + x.ms, 0) + elapsed) / TOTAL;
  const finished = !playing && i === SCENES.length - 1 && t >= 1;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[380px_1fr]">
      {/* phone frame */}
      <div className="mx-auto w-[340px] shrink-0">
        <div className="rounded-[2.75rem] bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-700">
          <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-slate-50">
            <div className="flex items-center gap-2 bg-teal-700 px-4 pt-5 pb-2.5 text-white">
              <Image
                src="/icon.svg"
                alt=""
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 rounded-md"
              />
              <span className="font-bold">ডেঙ্গুসাথী</span>
              <span className="ml-auto text-xs opacity-80">রহিম (৯)</span>
            </div>
            <div key={i} className="fade-up">
              {scene.render(t)}
            </div>
            {finished && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-teal-800/95 p-6 text-center text-white">
                <p className="text-2xl font-bold">
                  ৩ মিনিটে বাসায় বসেই বোঝা যায় কখন হাসপাতালে যেতে হবে
                </p>
                <Link
                  href="/p/demo-rahim"
                  className="rounded-2xl bg-white px-5 py-3 font-bold text-teal-800"
                >
                  <Play
                    className="mr-1 inline size-5 align-[-4px]"
                    aria-hidden
                  />
                  নিজে চেষ্টা করুন
                </Link>
                <button
                  onClick={() => {
                    go(0);
                    setPlaying(true);
                  }}
                  className="underline"
                >
                  আবার দেখুন
                </button>
              </div>
            )}
          </div>
        </div>
        {/* progress */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-teal-600"
            style={{ width: `${overall * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => go(i - 1)}
            className="btn-ghost !px-3 !py-2"
            aria-label="আগের ধাপ"
          >
            <SkipBack className="size-5" aria-hidden />
          </button>
          <button
            onClick={() => {
              if (finished) go(0);
              setPlaying((p) => !p || finished);
            }}
            className="btn-primary !px-6 !py-2"
          >
            {playing ? (
              <>
                <Pause className="size-5" aria-hidden /> থামান
              </>
            ) : (
              <>
                <Play className="size-5" aria-hidden /> চালান
              </>
            )}
          </button>
          <button
            onClick={() => go(i + 1)}
            className="btn-ghost !px-3 !py-2"
            aria-label="পরের ধাপ"
          >
            <SkipForward className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* captions / steps */}
      <ol className="flex flex-col gap-2">
        {SCENES.map((s, n) => (
          <li key={s.title}>
            <button
              onClick={() => {
                go(n);
                setPlaying(true);
              }}
              className={`w-full rounded-2xl p-4 text-left transition ${n === i ? "bg-white shadow-md ring-2 ring-teal-600" : "hover:bg-white/70"} ${n < i ? "opacity-70" : ""}`}
            >
              <p
                className={`text-lg font-bold ${n === i ? "text-teal-800" : ""}`}
              >
                {n < i && (
                  <Check
                    className="mr-1 inline size-4 align-[-3px] text-teal-700"
                    aria-hidden
                  />
                )}
                {s.title}
              </p>
              {n === i && <p className="mt-1 text-slate-700">{s.caption}</p>}
              {n === i && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-teal-600"
                    style={{ width: `${t * 100}%` }}
                  />
                </div>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
