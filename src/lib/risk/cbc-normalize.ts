import type { CbcExtraction } from "~/lib/ai/schemas";
import { THRESHOLDS as T } from "./thresholds";

/**
 * Convert a count as printed on a Bangladeshi CBC report into cells per microlitre.
 * Handles: "150000", "1,50,000", "150 x10^3/uL", "150 K/uL", "1.5 lakh", "150 x 10^9/L".
 * Unit conversion happens here in code, never inside the LLM.
 */
export function parseCount(raw: string | null, unit: string | null): number | null {
  if (!raw) return null;
  const text = `${raw} ${unit ?? ""}`.toLowerCase().replace(/\s+/g, " ");
  const numMatch = /(\d+(?:[.,]\d+)*)/.exec(raw.replace(/,(?=\d{2,3}\b)/g, ""));
  if (!numMatch) return null;
  const n = Number(numMatch[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;

  if (/lakh|lac/.test(text)) return Math.round(n * 100_000);
  // 10^9/L == 10^3/uL; 10^3/uL, k/uL, thou/uL all mean thousands per microlitre
  if (/10\s*(\^|\*\*|e)?\s*(3|9)|\bk\b|k\/|thou|[×x]\s*10/.test(text)) return Math.round(n * 1000);
  // Plain number: if small, it is almost certainly in thousands
  if (n < 2000) return Math.round(n * 1000);
  return Math.round(n);
}

function inRange(v: number | null, min: number, max: number): number | null {
  return v != null && v >= min && v <= max ? v : null;
}

export interface NormalizedCbc {
  plateletUl: number | null;
  hctPct: number | null;
  wbcUl: number | null;
  hbGdl: number | null;
  /** Fields that were read but failed the sanity check; ask the user to type them. */
  rejected: string[];
}

export function normalizeCbc(x: CbcExtraction): NormalizedCbc {
  const S = T.sanity;
  const rejected: string[] = [];
  const check = (name: string, v: number | null, min: number, max: number) => {
    const ok = inRange(v, min, max);
    if (v != null && ok == null) rejected.push(name);
    return ok;
  };
  return {
    plateletUl: check("platelet", parseCount(x.plateletRaw, x.plateletUnit), S.plateletMin, S.plateletMax),
    hctPct: check("hematocrit", x.hematocritPct, S.hctMin, S.hctMax),
    wbcUl: check("wbc", parseCount(x.wbcRaw, x.wbcUnit), S.wbcMin, S.wbcMax),
    hbGdl: check("hemoglobin", x.hemoglobinGdl, S.hbMin, S.hbMax),
    rejected,
  };
}
