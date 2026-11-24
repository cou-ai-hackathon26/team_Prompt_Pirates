import { toBn } from "~/lib/bn";

const mmss = (s: number) =>
  `${toBn(String(Math.floor(s / 60)).padStart(2, "0"))}:${toBn(String(s % 60).padStart(2, "0"))}`;

/**
 * Live voice bars + timer under the mic button (idea from the "AI Voice Input" pattern on 21st.dev).
 * Bars come from the real microphone frequency data, so the family sees that the phone is hearing them.
 * Bars are decorative (aria-hidden); the timer uses role=timer (not announced every second).
 */
export function VoiceVisualizer({
  bars,
  active,
  elapsed,
  max,
}: {
  bars: number[];
  active: boolean;
  elapsed: number;
  max: number;
}) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <div
        aria-hidden
        className="flex h-12 w-full items-center justify-center gap-[3px]"
      >
        {bars.map((v, i) => (
          <span
            key={i}
            className={`w-1 rounded-full transition-[height] duration-75 ${active ? "bg-red-500" : "bg-slate-300"}`}
            style={{ height: `${active ? Math.max(8, v * 100) : 8}%` }}
          />
        ))}
      </div>
      <p className="font-mono text-lg text-slate-700 tabular-nums" role="timer">
        <span className={active ? "text-red-600" : ""}>{mmss(elapsed)}</span>
        <span className="text-slate-500"> / {mmss(max)}</span>
      </p>
    </div>
  );
}
