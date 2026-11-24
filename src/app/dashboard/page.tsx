import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { authConfigured, auth, getStaff, signIn, signOut } from "~/server/auth";
import { DashboardView } from "./dashboard-view";

// Depends on the signed-in user: never cache.
export const dynamic = "force-dynamic";

function GoogleButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/dashboard" });
      }}
    >
      <button type="submit" className="btn-primary w-full sm:w-auto">
        <svg viewBox="0 0 48 48" className="size-5 rounded-full bg-white p-0.5" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.5 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4-13.5-9.6l-7.8 6C6.6 42.6 14.6 48 24 48z" />
        </svg>
        Google দিয়ে স্টাফ লগইন
      </button>
    </form>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/dashboard" });
      }}
    >
      <button type="submit" className="btn-ghost min-h-11 gap-1 text-sm">
        <LogOut className="size-4" aria-hidden /> লগআউট
      </button>
    </form>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <LockKeyhole className="size-7" aria-hidden />
      </span>
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const staff = await getStaff();
  // Signed in but not on the list (only possible when STAFF_EMAILS is set).
  const session = staff || !authConfigured ? null : await auth().catch(() => null);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">হাসপাতাল ও উপজেলা ড্যাশবোর্ড</h1>
          <p className="text-slate-600">
            বাসায় থাকা ডেঙ্গু রোগীদের বেনামি চিত্র: কোন এলাকা থেকে গুরুতর রোগী আসছে,
            আগেভাগে জানুন
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            প্রোটোটাইপ: কৃত্রিম (synthetic) ডেটা
          </span>
          {staff && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
              <ShieldCheck className="size-4" aria-hidden /> {staff.email}
            </span>
          )}
          {staff && <SignOutButton />}
        </div>
      </header>

      {staff ? (
        <DashboardView />
      ) : !authConfigured ? (
        <Gate>
          <h2 className="text-xl font-bold">স্টাফ লগইন এখনো চালু হয়নি</h2>
          <p className="text-slate-600">
            এই ড্যাশবোর্ড শুধু হাসপাতাল ও স্বাস্থ্য কর্মকর্তাদের জন্য। অ্যাডমিন: সার্ভারে
            AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET সেট করুন।
          </p>
        </Gate>
      ) : session?.user ? (
        <Gate>
          <h2 className="text-xl font-bold">এই অ্যাকাউন্টের অনুমতি নেই</h2>
          <p className="text-slate-600">
            {session.user.email} দিয়ে লগইন করা আছে, কিন্তু এটি স্টাফ তালিকায় নেই। অন্য
            অ্যাকাউন্টে চেষ্টা করুন বা অ্যাডমিনকে জানান।
          </p>
          <SignOutButton />
        </Gate>
      ) : (
        <Gate>
          <h2 className="text-xl font-bold">শুধু হাসপাতাল ও স্বাস্থ্য কর্মকর্তাদের জন্য</h2>
          <p className="text-slate-600">
            এলাকাভিত্তিক রোগীর চিত্র দেখতে লগইন করুন। পরিবারের জন্য কোনো লগইন লাগে না।
          </p>
          <GoogleButton />
        </Gate>
      )}
    </main>
  );
}
