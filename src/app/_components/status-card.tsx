"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Reason, Status } from "~/lib/risk/who-rules";
import { STATUS_META } from "~/lib/status-meta";
import {
  CircleCheck,
  ClipboardList,
  Hospital,
  Siren,
  TriangleAlert,
  Volume2,
} from "lucide-react";

export function StatusCard({
  status,
  adviceBn,
  reasons,
  updatedAt,
  hospitalsHref,
  handoffHref,
  autoPlay = false,
  compact = false,
}: {
  status: Status;
  adviceBn: string;
  reasons: Reason[];
  updatedAt?: Date;
  hospitalsHref?: string;
  /** Doctor-facing one-page summary (shown for YELLOW/RED) */
  handoffHref?: string;
  autoPlay?: boolean;
  compact?: boolean;
}) {
  const meta = STATUS_META[status];
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = () => {
    // Prefer the pre-recorded Bangla clip; fall back to the browser's Bangla voice if present.
    const a =
      audioRef.current ?? new Audio(`/audio/${status.toLowerCase()}.wav`);
    audioRef.current = a;
    setSpeaking(true);
    a.onended = () => setSpeaking(false);
    a.play().catch(() => {
      const u = new SpeechSynthesisUtterance(`${meta.sub}। ${adviceBn}`);
      u.lang = "bn-BD";
      u.onend = () => setSpeaking(false);
      speechSynthesis.speak(u);
    });
  };

  useEffect(() => {
    if (autoPlay && status === "RED") speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, status]);

  return (
    <section
      className={`overflow-hidden rounded-3xl text-white shadow-lg ring-4 ${meta.bg} ${meta.ring} ${status === "RED" ? "animate-[pulse-ring_2s_ease-in-out_infinite]" : ""}`}
    >
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/25">
          {status === "RED" ? (
            <Siren className="size-9" aria-hidden />
          ) : status === "YELLOW" ? (
            <TriangleAlert className="size-9" aria-hidden />
          ) : (
            <CircleCheck className="size-9" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium opacity-90">
            আজকের অবস্থা: {meta.title}
          </p>
          <p className="text-2xl leading-tight font-bold sm:text-3xl">
            {meta.sub}
          </p>
        </div>
        <button
          onClick={speak}
          aria-label="শুনুন"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-4 text-sm font-semibold transition-colors hover:bg-white/30"
        >
          <Volume2 className="size-4" aria-hidden />
          {speaking ? "বলছে..." : "শুনুন"}
        </button>
      </div>

      <div className="bg-black/10 px-5 py-4">
        <p className="leading-relaxed">{adviceBn}</p>
        {!compact && reasons.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span className="flex-1">{r.textBn}</span>
                <span className="shrink-0 rounded bg-white/25 px-1.5 text-[11px] font-semibold">
                  {r.source === "ai" ? "AI" : "নিয়ম"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {hospitalsHref && status !== "GREEN" && (
          <Link
            href={hospitalsHref}
            className={`mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-lg font-bold ${meta.text}`}
          >
            <Hospital className="size-5" aria-hidden /> নিকটস্থ হাসপাতাল দেখুন
          </Link>
        )}
        {handoffHref && status !== "GREEN" && (
          <Link
            href={handoffHref}
            className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-white/70 py-2.5 font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ClipboardList className="size-5" aria-hidden /> ডাক্তারের জন্য সারাংশ
            (সাথে নিন)
          </Link>
        )}
        {updatedAt && (
          <p className="mt-3 text-xs opacity-80">
            শেষ হালনাগাদ:{" "}
            {updatedAt.toLocaleString("bn-BD", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
    </section>
  );
}
