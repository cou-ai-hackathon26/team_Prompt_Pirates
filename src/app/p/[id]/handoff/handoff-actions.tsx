"use client";

import { ArrowLeft, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function HandoffActions({
  patientId,
  url,
}: {
  patientId: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      await navigator
        .share({ title: "DengueSathi clinical summary", url })
        .catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Link href={`/p/${patientId}`} className="btn-ghost !px-3">
        <ArrowLeft className="size-5" aria-hidden /> ফিরুন
      </Link>
      <button onClick={() => window.print()} className="btn-primary flex-1">
        <Printer className="size-5" aria-hidden /> প্রিন্ট / PDF
      </button>
      <button onClick={share} className="btn-outline flex-1">
        <Share2 className="size-5" aria-hidden />{" "}
        {copied ? "লিংক কপি হয়েছে" : "শেয়ার"}
      </button>
    </div>
  );
}
