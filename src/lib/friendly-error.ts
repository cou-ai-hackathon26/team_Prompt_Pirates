/**
 * Turn a fetch / tRPC error into a message a family can act on. Network failures ("Failed to fetch",
 * Safari "Load failed", a dropped mobile connection) become a Bangla "check the internet and retry";
 * our own server errors are already in Bangla and pass through unchanged.
 */
const NETWORK =
  /failed to fetch|fetch failed|load failed|networkerror|network request failed|err_internet|err_connection|timed? ?out|aborted/i;

export function friendlyError(e: { message?: string } | null | undefined): string {
  const msg = e?.message ?? "";
  if (!msg || NETWORK.test(msg))
    return "ইন্টারনেট সংযোগ পাওয়া যায়নি। নেট চালু আছে কিনা দেখে আবার চাপুন। আপনার দেওয়া তথ্য মুছে যায়নি।";
  // Bangla server messages are written for families; show them as they are.
  if (/[ঀ-৿]/.test(msg)) return msg;
  return "সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।";
}
