"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toBn } from "~/lib/bn";

/**
 * Staged progress for slow AI calls, so a 5-30 s wait reads as work being done
 * ("শুনছি ✓ → বুঝছি ✓ → WHO নিয়ম যাচাই …") instead of a bare spinner.
 * Stages advance on a timer (we don't get server-side progress events); the last stage
 * stays active until the request really finishes, so it never claims to be done early.
 */
export function AiProgress({
  title,
  stages,
  stepMs = 2500,
  hint,
}: {
  title: string;
  stages: string[];
  stepMs?: number;
  hint?: string;
}) {
  const [active, setActive] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - t0;
      setSeconds(Math.floor(ms / 1000));
      setActive(Math.min(stages.length - 1, Math.floor(ms / stepMs)));
    }, 250);
    return () => clearInterval(id);
  }, [stages.length, stepMs]);

  return (
    <div
      className="card flex flex-col gap-4 py-8"
      role="status"
      aria-live="polite"
    >
      <p className="text-center text-xl font-bold">{title}</p>
      <ol className="mx-auto flex w-full max-w-xs flex-col gap-3">
        {stages.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                  done
                    ? "bg-teal-700 text-white"
                    : now
                      ? "bg-teal-50 text-teal-700 ring-2 ring-teal-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? (
                  <Check className="size-4" aria-hidden />
                ) : now ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <span className="text-sm font-bold">{toBn(i + 1)}</span>
                )}
              </span>
              <span
                className={`text-lg ${done ? "text-slate-700" : now ? "font-semibold text-teal-800" : "text-slate-500"}`}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-sm text-slate-600">
        {hint ?? "সাধারণত ৫-২০ সেকেন্ড লাগে"}
        <span aria-hidden> · {toBn(seconds)} সেকেন্ড</span>
      </p>
    </div>
  );
}
