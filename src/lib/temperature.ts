const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "১০২.৫" -> "102.5"; also accepts the Bangla full stop / comma as a decimal point. */
export function toAsciiNumber(s: string): string {
  return s
    .trim()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[।,]/g, ".")
    .replace(/[^\d.]/g, "");
}

/**
 * Parse a typed temperature. 95-108 is °F; 35-42 is treated as °C and converted.
 * Returns f = null while the text is incomplete or out of range.
 */
export function parseTemperatureF(text: string): {
  f: number | null;
  fromCelsius: boolean;
  error: string | null;
} {
  const raw = toAsciiNumber(text);
  if (raw === "") return { f: null, fromCelsius: false, error: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { f: null, fromCelsius: false, error: "সঠিক সংখ্যা লিখুন" };
  if (n >= 95 && n <= 108) return { f: Math.round(n * 10) / 10, fromCelsius: false, error: null };
  if (n >= 35 && n <= 42)
    return { f: Math.round((n * 9) / 5 * 10 + 320) / 10, fromCelsius: true, error: null };
  return { f: null, fromCelsius: false, error: "৯৫ থেকে ১০৮°F এর মধ্যে লিখুন" };
}
