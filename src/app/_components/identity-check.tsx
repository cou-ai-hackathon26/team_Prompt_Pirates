"use client";

import Link from "next/link";
import { Phone, Siren, UserRoundCheck, UserRoundX } from "lucide-react";

type Status = "GREEN" | "YELLOW" | "RED";

/**
 * Shown when a voice message or CBC report seems to be about another person.
 * Nothing has been saved yet; the family decides.
 */
export function IdentityCheck({
  patientName,
  what,
  conflicts,
  busy,
  onSame,
  onOther,
}: {
  patientName: string;
  /** "রিপোর্ট" or "কথা" */
  what: "report" | "voice";
  conflicts: { code: string; textBn: string }[];
  busy: boolean;
  onSame: () => void;
  onOther: () => void;
}) {
  const name = patientName.replace(/\s*\(.*\)\s*/, "");
  return (
    <div role="alertdialog" aria-labelledby="idc-title" className="card fade-up flex flex-col gap-4 ring-2 ring-amber-400">
      <h2 id="idc-title" className="text-2xl font-bold">
        {what === "report" ? `এই রিপোর্ট কি ${name}-এর?` : `এই কথাগুলো কি ${name}-এর?`}
      </h2>
      <p className="text-slate-700">
        {what === "report"
          ? "রিপোর্টের তথ্য রোগীর তথ্যের সাথে মিলছে না:"
          : "আপনার কথায় যার বর্ণনা আছে, তার তথ্য রোগীর সাথে মিলছে না:"}
      </p>
      <ul className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-3 text-amber-950">
        {conflicts.map((c) => (
          <li key={c.code}>• {c.textBn}</li>
        ))}
      </ul>
      <p className="text-sm text-slate-600">
        ভুল রোগীর তথ্য দিলে ঝুঁকির হিসাব ভুল হবে, তাই এখনো কিছু সংরক্ষণ করা হয়নি।
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn-primary" disabled={busy} onClick={onSame}>
          <UserRoundCheck className="size-5" aria-hidden />
          হ্যাঁ, {name}-এরই
        </button>
        <button className="btn-outline" disabled={busy} onClick={onOther}>
          <UserRoundX className="size-5" aria-hidden />
          না, অন্য কারো
        </button>
      </div>
    </div>
  );
}

/** After "না, অন্য কারো": nothing saved, but warn if that other person is in danger. */
export function OtherPersonNotice({
  what,
  dangerIfOther,
  patientId,
  onRetry,
}: {
  what: "report" | "voice";
  dangerIfOther: Status;
  patientId: string;
  onRetry: () => void;
}) {
  const whose = what === "report" ? "যার রিপোর্ট" : "যার কথা বললেন";
  return (
    <div className="flex flex-col gap-4">
      {dangerIfOther !== "GREEN" && (
        <div
          role="alert"
          className={`card fade-up flex flex-col gap-3 text-white ring-0 ${dangerIfOther === "RED" ? "bg-red-700" : "bg-amber-600"}`}
        >
          <p className="flex items-center gap-2 text-xl font-bold">
            <Siren className="size-6" aria-hidden />
            {dangerIfOther === "RED"
              ? `${whose}, তাকে এখনই হাসপাতালে নিন`
              : `${whose}, তাকে আজই ডাক্তার দেখান`}
          </p>
          <p>
            এই তথ্যে ডেঙ্গুর বিপদচিহ্ন আছে। তার জন্য আলাদা করে ডেঙ্গুসাথীতে নতুন রোগী যোগ করুন।
          </p>
          <div className="flex flex-wrap gap-2">
            {/* 999 = National Emergency Service (ambulance). 16263 = health advice line only. */}
            {dangerIfOther === "RED" && (
              <a href="tel:999" className="btn bg-white text-red-800">
                <Phone className="size-5" aria-hidden /> অ্যাম্বুলেন্স ৯৯৯
              </a>
            )}
            <a
              href="tel:16263"
              className={
                dangerIfOther === "RED"
                  ? "btn bg-white/15 text-white ring-1 ring-white/60"
                  : "btn bg-white text-amber-800"
              }
            >
              {dangerIfOther !== "RED" && <Phone className="size-5" aria-hidden />}
              ডাক্তারের পরামর্শ ১৬২৬৩
            </a>
            <Link href="/new" className="btn bg-white/15 text-white ring-1 ring-white/60">
              নতুন রোগী যোগ করুন
            </Link>
          </div>
        </div>
      )}
      <div className="card fade-up">
        <p className="text-lg font-semibold">এই রোগীর জন্য কিছু সংরক্ষণ করা হয়নি।</p>
        <p className="mt-1 text-slate-600">ঠিক রোগীর তথ্য দিয়ে আবার চেষ্টা করুন।</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onRetry}>
            আবার দিন
          </button>
          <Link href={`/p/${patientId}`} className="btn-ghost">
            রোগীর পাতায় ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}
