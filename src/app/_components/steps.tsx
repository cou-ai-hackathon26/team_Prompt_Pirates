import { Check } from "lucide-react";
import { toBn } from "~/lib/bn";

/**
 * Compact 3-step progress indicator ("① বলুন — ② মিলিয়ে নিন — ③ ফলাফল").
 * Pattern inspired by onboarding-wizard steppers on 21st.dev; built to our design system
 * (teal, Bangla numerals, colour + icon + text so state is never conveyed by colour alone).
 */
export function Steps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol aria-label="ধাপ" className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2 last:flex-none"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200 ${
                done
                  ? "bg-teal-700 text-white"
                  : active
                    ? "bg-teal-700 text-white ring-4 ring-teal-100"
                    : "border-2 border-slate-300 bg-white text-slate-600"
              }`}
            >
              {done ? <Check className="size-4" aria-hidden /> : toBn(i + 1)}
            </span>
            <span
              className={`text-sm font-semibold whitespace-nowrap ${active ? "text-teal-800" : done ? "text-slate-700" : "text-slate-500"}`}
            >
              {label}
              {done && <span className="sr-only"> (সম্পন্ন)</span>}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`h-0.5 min-w-3 flex-1 rounded-full ${done ? "bg-teal-700" : "bg-slate-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
