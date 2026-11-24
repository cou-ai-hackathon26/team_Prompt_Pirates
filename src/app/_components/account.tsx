"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, CloudCheck, CloudUpload, LogOut, Users, X } from "lucide-react";
import { localPatientIds } from "~/lib/local-patients";
import { toBn } from "~/lib/bn";
import { api } from "~/trpc/react";

/*
 * Optional family login (Google). Rules:
 *  - never required, never asked at the start or inside a check-in / CBC flow;
 *  - offered on the patient page AFTER a result exists (there is now something worth keeping),
 *    never on a RED screen (that screen is only about getting to hospital);
 *  - on the home page, a returning family on a new phone can find their patients.
 */

const DISMISS_KEY = "denguesathi.savePromptUntil";
const DISMISS_DAYS = 3;

const googleSignIn = (redirectTo: string) => void signIn("google", { redirectTo });

/** Mounted once in the layout: after sign-in, link every patient opened on this phone to the account. */
export function AccountSync() {
  const me = api.account.me.useQuery(undefined, { staleTime: 5 * 60_000 });
  const utils = api.useUtils();
  const claim = api.account.claim.useMutation({
    onSuccess: (r) => {
      if (r.linked > 0) void utils.account.myPatients.invalidate();
    },
  });
  const path = usePathname();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (!me.data) return;
    const ids = localPatientIds().filter((id) => !sent.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => sent.current.add(id));
    claim.mutate({ patientIds: ids });
    // Re-check on navigation: opening a shared patient link adds a new local patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, path]);

  return null;
}

/** Patient page, under the status card: "save to Google so you don't lose this". */
export function SavePrompt({ status }: { status: "GREEN" | "YELLOW" | "RED" | null }) {
  const me = api.account.me.useQuery(undefined, { staleTime: 5 * 60_000 });
  const path = usePathname();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now());
  }, []);

  if (me.isLoading || me.isError) return null;

  if (me.data)
    return (
      <p className="flex items-center gap-2 px-1 text-sm text-slate-600">
        <CloudCheck className="size-4 text-teal-700" aria-hidden />
        {me.data.email} অ্যাকাউন্টে সেভ করা আছে। যেকোনো ফোনে লগইন করে দেখতে পারবেন।
      </p>
    );

  // Nothing to keep yet, the family chose "later", or this is an emergency screen.
  if (!status || status === "RED" || hidden) return null;

  return (
    <section className="card fade-up flex flex-col gap-3 bg-teal-50 ring-teal-200">
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 size-6 shrink-0 text-teal-700" aria-hidden />
        <div className="flex-1">
          <p className="font-bold">রোগীর তথ্য হারাবেন না</p>
          <p className="text-sm text-slate-700">
            এই ফোন হারালে বা বদলালে তথ্য খুঁজে পাবেন না। Google দিয়ে সেভ করলে যেকোনো ফোনে
            &ldquo;আমার রোগী&rdquo; থেকে খুলতে পারবেন। লগইন ছাড়াও অ্যাপ চলবে।
          </p>
        </div>
        <button
          type="button"
          aria-label="বন্ধ করুন"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5));
            setHidden(true);
          }}
          className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => googleSignIn(path)}>
          Google দিয়ে সেভ করুন
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5));
            setHidden(true);
          }}
        >
          পরে
        </button>
      </div>
    </section>
  );
}

const STATUS_DOT = { GREEN: "bg-green-600", YELLOW: "bg-yellow-500", RED: "bg-red-600" } as const;
const STATUS_BN = { GREEN: "সবুজ", YELLOW: "হলুদ", RED: "লাল" } as const;

/** Home page: the signed-in family's patients, or a way back in from a new phone. */
export function MyPatients() {
  const me = api.account.me.useQuery(undefined, { staleTime: 5 * 60_000 });
  const list = api.account.myPatients.useQuery(undefined, { enabled: !!me.data });

  if (me.isLoading || me.isError) return null;

  if (!me.data)
    return (
      <button
        type="button"
        onClick={() => googleSignIn("/")}
        className="flex min-h-11 items-center gap-2 text-left text-sm font-semibold text-teal-800 underline-offset-4 hover:underline"
      >
        <Users className="size-4" aria-hidden />
        আগে রোগী যোগ করেছেন? Google দিয়ে খুঁজুন
      </button>
    );

  const patients = list.data ?? [];
  return (
    <section className="card flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Users className="size-5 text-teal-700" aria-hidden /> আমার রোগী
        </h2>
        <button
          type="button"
          onClick={() => void signOut({ redirectTo: "/" })}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-600"
        >
          <LogOut className="size-4" aria-hidden /> লগআউট
        </button>
      </div>
      <p className="truncate text-xs text-slate-500">{me.data.email}</p>
      {list.isLoading ? (
        <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ) : patients.length === 0 ? (
        <p className="text-sm text-slate-600">
          এখনো কোনো রোগী সেভ করা নেই। নতুন রোগী যোগ করলে বা রোগীর লিংক খুললে এখানে দেখাবে।
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {patients.map((p) => (
            <li key={p.id}>
              <Link href={`/p/${p.id}`} className="flex min-h-12 items-center gap-3 py-2">
                <span
                  className={`size-3 shrink-0 rounded-full ${p.status ? STATUS_DOT[p.status] : "bg-slate-300"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.nickname}</span>
                  <span className="block truncate text-xs text-slate-500">
                    জ্বরের {toBn(p.dayOfFever)} নম্বর দিন · {p.areaBn}
                    {p.status ? ` · ${STATUS_BN[p.status]}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {me.data.staff && (
        <Link href="/dashboard" className="text-sm font-semibold text-teal-800">
          হাসপাতাল ড্যাশবোর্ড →
        </Link>
      )}
    </section>
  );
}
