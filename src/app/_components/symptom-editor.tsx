"use client";

import type { Symptoms } from "~/lib/ai/schemas";
import { BOOL_SYMPTOMS, PAIN_LABEL, toBn } from "~/lib/symptom-labels";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { parseTemperatureF } from "~/lib/temperature";

/**
 * Editable symptom form. Used both to confirm what the AI heard and as the tap-only fallback.
 * `highlight` = fields the AI was unsure about (shown with a yellow outline).
 */
export function SymptomEditor({
  value,
  onChange,
  highlight = [],
}: {
  value: Symptoms;
  onChange: (s: Symptoms) => void;
  highlight?: string[];
}) {
  const set = <K extends keyof Symptoms>(k: K, v: Symptoms[K]) =>
    onChange({ ...value, [k]: v });
  const hl = (k: string) =>
    highlight.includes(k) ? "ring-2 ring-yellow-400 ring-offset-2" : "";

  return (
    <div className="flex flex-col gap-5">
      <div className={`rounded-2xl ${hl("abdominalPain")}`}>
        <p className="mb-2 font-semibold">পেটে ব্যথা</p>
        <div className="grid grid-cols-3 gap-2">
          {(["none", "mild", "severe"] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() =>
                set("abdominalPain", value.abdominalPain === p ? null : p)
              }
              className={`rounded-xl border-2 py-2.5 font-semibold ${
                value.abdominalPain === p
                  ? p === "severe"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-teal-700 bg-teal-700 text-white"
                  : "border-slate-300"
              }`}
            >
              {PAIN_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl ${hl("vomitingCount24h")}`}>
          <p className="mb-2 font-semibold">২৪ ঘণ্টায় বমি</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="কমান"
              className="h-11 w-11 rounded-xl bg-slate-100 text-2xl font-bold"
              onClick={() =>
                set(
                  "vomitingCount24h",
                  Math.max(0, (value.vomitingCount24h ?? 0) - 1),
                )
              }
            >
              −
            </button>
            <span
              className={`w-12 text-center text-2xl font-bold ${(value.vomitingCount24h ?? 0) >= 3 ? "text-red-600" : ""}`}
            >
              {value.vomitingCount24h == null
                ? "?"
                : toBn(value.vomitingCount24h)}
            </span>
            <button
              type="button"
              aria-label="বাড়ান"
              className="h-11 w-11 rounded-xl bg-slate-100 text-2xl font-bold"
              onClick={() =>
                set(
                  "vomitingCount24h",
                  Math.min(30, (value.vomitingCount24h ?? 0) + 1),
                )
              }
            >
              +
            </button>
          </div>
        </div>
        <label className={`flex flex-col rounded-2xl ${hl("temperatureF")}`}>
          <span className="mb-2 font-semibold">তাপমাত্রা (°F)</span>
          <TemperatureInput
            value={value.temperatureF}
            onChange={(f) => set("temperatureF", f)}
          />
        </label>
      </div>

      <div>
        <p className="mb-2 font-semibold">
          যা যা দেখা যাচ্ছে, চাপ দিয়ে বেছে নিন
        </p>
        <div className="flex flex-wrap gap-2">
          {BOOL_SYMPTOMS.map((b) => {
            const on = b.invert
              ? value[b.key] === false
              : value[b.key] === true;
            return (
              <button
                type="button"
                key={b.key}
                aria-pressed={on}
                onClick={() => set(b.key, on ? null : !b.invert)}
                className={`inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-3.5 py-2 text-[15px] font-medium transition-colors ${hl(b.key)} ${
                  on
                    ? b.danger
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {on && <Check className="size-4" aria-hidden />}
                {b.label}
                {b.danger && !on && (
                  <span className="ml-1 text-red-500">•</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <span className="text-red-500">•</span> চিহ্ন দেওয়াগুলো বিপদচিহ্ন। এর
          যেকোনো একটি থাকলে সাথে সাথে হাসপাতালে যেতে হবে।
        </p>
      </div>
    </div>
  );
}

/**
 * Free-typing temperature box. Keeps the raw text while typing (so "1" -> "10" -> "102" works),
 * accepts Bangla digits from a Bangla keyboard, and converts a Celsius reading (35-42) to °F.
 */
function TemperatureInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (f: number | null) => void;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const parsed = parseTemperatureF(text);

  // Sync when the value changes from outside (e.g. the AI filled it in).
  useEffect(() => {
    if (value !== parseTemperatureF(text).f) setText(value != null ? String(value) : "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder="যেমন ১০২"
        aria-invalid={parsed.error != null}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseTemperatureF(e.target.value);
          onChange(p.f);
        }}
        className="input"
      />
      {parsed.fromCelsius && parsed.f != null && (
        <span className="mt-1 text-sm text-slate-600">
          সেলসিয়াস ধরে নেওয়া হলো = {toBn(parsed.f)}°F
        </span>
      )}
      {parsed.error && text.trim().length >= 3 && (
        <span className="mt-1 text-sm text-red-600">{parsed.error}</span>
      )}
    </>
  );
}
