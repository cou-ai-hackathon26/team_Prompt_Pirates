"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/** Friendly Bangla error page (e.g. the free database is waking up, or the network dropped). */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <TriangleAlert className="size-16 text-red-600" aria-hidden />
      <h1 className="text-2xl font-bold">কিছু একটা সমস্যা হয়েছে</h1>
      <p className="text-slate-600">
        ইন্টারনেট বা সার্ভার কিছুক্ষণের জন্য সাড়া দিচ্ছে না। কয়েক সেকেন্ড পরে আবার
        চেষ্টা করুন।
      </p>
      <p className="rounded-xl bg-red-50 p-3 text-red-700">
        রোগীর অবস্থা খারাপ হলে অপেক্ষা করবেন না: নিকটস্থ হাসপাতালে যান বা ৯৯৯ এ কল
        করুন।
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">
          আবার চেষ্টা করুন
        </button>
        <Link href="/" className="btn-outline">
          হোম
        </Link>
      </div>
    </main>
  );
}
