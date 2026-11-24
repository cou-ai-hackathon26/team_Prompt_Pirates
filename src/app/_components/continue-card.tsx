"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEY } from "~/app/_components/new-patient-form";
import { ArrowRight, User } from "lucide-react";

/** Shows "continue with your patient" when this phone already has one. */
export function ContinueCard() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(localStorage.getItem(STORAGE_KEY)), []);
  if (!id) return null;
  return (
    <Link
      href={`/p/${id}`}
      className="card flex items-center gap-3 ring-2 ring-teal-600 hover:bg-teal-50"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <User className="size-6" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block font-bold">আপনার রোগীর পাতা</span>
        <span className="block text-sm text-slate-600">
          আজকের আপডেট দিতে এখানে চাপুন
        </span>
      </span>
      <ArrowRight className="size-6 text-teal-700" aria-hidden />
    </Link>
  );
}
