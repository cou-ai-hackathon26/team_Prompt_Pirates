/**
 * Patients opened on this phone (browser only). The newest is also kept under the original
 * single-patient key so older code paths keep working.
 */
export const STORAGE_KEY = "denguesathi.patientId";
const LIST_KEY = "denguesathi.patientIds";

export function localPatientIds(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) ?? "[]") as unknown;
    const ids = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
    const single = localStorage.getItem(STORAGE_KEY);
    return [...new Set([...(single ? [single] : []), ...ids])].slice(0, 20);
  } catch {
    return [];
  }
}

export function rememberPatient(id: string, { makeCurrent = true } = {}) {
  const ids = [id, ...localPatientIds().filter((x) => x !== id)].slice(0, 20);
  localStorage.setItem(LIST_KEY, JSON.stringify(ids));
  if (makeCurrent || !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, id);
}
