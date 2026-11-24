/**
 * Area-level spike detection for the hospital dashboard.
 * For each area: compare today's count of severe (RED + YELLOW) patients with the
 * mean and standard deviation of the previous `baselineDays` days (a simple z-score).
 */
export interface DailyCount {
  /** yyyy-mm-dd */
  day: string;
  count: number;
}

export interface SpikeResult {
  today: number;
  mean: number;
  sd: number;
  z: number | null;
  isSpike: boolean;
  /** How many times higher than the baseline mean today is */
  ratio: number | null;
}

export const SPIKE_MIN_COUNT = 3;
export const SPIKE_Z = 2;
/** Also require a practically meaningful rise, so a very steady baseline does not flag tiny bumps. */
export const SPIKE_MIN_RATIO = 1.5;

export function detectSpike(series: DailyCount[], baselineDays = 14): SpikeResult {
  const sorted = [...series].sort((a, b) => a.day.localeCompare(b.day));
  const today = sorted.at(-1)?.count ?? 0;
  const base = sorted.slice(-1 - baselineDays, -1).map((d) => d.count);

  if (base.length === 0) return { today, mean: 0, sd: 0, z: null, isSpike: false, ratio: null };

  const mean = base.reduce((a, b) => a + b, 0) / base.length;
  const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length);
  // Daily case counts are roughly Poisson, whose natural spread is sqrt(mean). Floor the SD at
  // max(1, sqrt(mean)) so a flat, quiet baseline does not make small random bumps look like spikes.
  const z = (today - mean) / Math.max(sd, 1, Math.sqrt(mean));
  return {
    today,
    mean,
    sd,
    z,
    isSpike: today >= SPIKE_MIN_COUNT && z >= SPIKE_Z && (mean === 0 || today / mean >= SPIKE_MIN_RATIO),
    ratio: mean > 0 ? today / mean : null,
  };
}

/** Fill missing days with 0 so the series is continuous. */
export function fillDays(counts: Map<string, number>, days: string[]): DailyCount[] {
  return days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

/** Last `n` calendar days as yyyy-mm-dd in Asia/Dhaka time, oldest first. */
export function lastNDays(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dhakaDay(new Date(now.getTime() - i * 864e5)));
  return out;
}

export function dhakaDay(d: Date): string {
  return new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);
}
