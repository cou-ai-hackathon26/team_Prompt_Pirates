"use client";

import { useEffect, useState } from "react";
import { rememberPatient } from "~/lib/local-patients";
import { Check, Share2 } from "lucide-react";

/** Copy the patient link so another family member can open the same patient. Also remembers it on this phone. */
export function ShareButton({ patientId }: { patientId: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // Opening a shared link remembers the patient on this phone (without replacing the current one).
    rememberPatient(patientId, { makeCurrent: false });
  }, [patientId]);

  const share = async () => {
    const url = `${location.origin}/p/${patientId}`;
    if (navigator.share) {
      await navigator
        .share({ title: "ডেঙ্গুসাথী", text: "রোগীর অবস্থা দেখুন", url })
        .catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={share}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden /> লিংক কপি হয়েছে
        </>
      ) : (
        <>
          <Share2 className="size-4" aria-hidden /> পরিবারের সাথে শেয়ার
        </>
      )}
    </button>
  );
}
