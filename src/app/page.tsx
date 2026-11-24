import Link from "next/link";
import { MyPatients } from "~/app/_components/account";
import { ContinueCard } from "~/app/_components/continue-card";
import { FlaskConical, Gauge, Hospital, Mic, Play, Plus } from "lucide-react";

const FEATURES = [
  {
    icon: Mic,
    title: "বাংলায় কথা বলে আপডেট",
    text: "প্রতিদিন রোগীর অবস্থা মুখে বলুন। AI উপসর্গগুলো বুঝে নেয়।",
  },
  {
    icon: FlaskConical,
    title: "CBC রিপোর্টের ছবি",
    text: "রিপোর্টের ছবি দিন। AI প্লাটিলেট ও হেমাটোক্রিট পড়ে ট্রেন্ড দেখায়।",
  },
  {
    icon: Gauge,
    title: "সবুজ / হলুদ / লাল সংকেত",
    text: "WHO-র সতর্কসংকেত নিয়মে প্রতিদিন জানাবে কখন হাসপাতালে যেতে হবে।",
  },
  {
    icon: Hospital,
    title: "নিকটস্থ হাসপাতাল",
    text: "লাল সংকেতে কাছের সরকারি হাসপাতাল ও দিকনির্দেশনা।",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
      <section className="relative isolate grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        {/* static dot-grid backdrop, faded at the edges (background pattern idea from 21st.dev; no motion) */}
        <div
          aria-hidden
          className="hero-dots pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10"
        />
        <div className="fade-up">
          <p className="mb-3 inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
            DGHS পর্যালোচনা: ১১৪টি ডেঙ্গু মৃত্যুর ৬৬টি (৫৮%) ভর্তির ২৪ ঘণ্টার মধ্যে
          </p>
          <h1 className="text-4xl leading-tight font-bold text-slate-900 sm:text-5xl">
            জ্বর কমলেই নিশ্চিন্ত নয়।
            <span className="block text-teal-700">
              ডেঙ্গুসাথী জানাবে কখন হাসপাতালে যেতে হবে।
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            বাসায় থাকা ডেঙ্গু রোগীর প্রতিদিনের খোঁজ রাখুন, বাংলায় কথা বলে। জ্বরের ৩য়
            থেকে ৭ম দিন সবচেয়ে ঝুঁকির, ঠিক তখনই পরিবার ভাবে রোগী সেরে উঠছে।
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/new" className="btn-primary">
              <Plus className="size-5" aria-hidden /> নতুন রোগী শুরু করুন
            </Link>
            <Link href="/p/demo-rahim" className="btn-outline">
              <Play className="size-5" aria-hidden /> ডেমো রোগী দেখুন
            </Link>
          </div>
          <Link
            href="/how-it-works"
            className="mt-4 inline-block font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            কিভাবে কাজ করে, দেখুন →
          </Link>
        </div>
        <div
          className="fade-up flex flex-col gap-3"
          style={{ animationDelay: "120ms" }}
        >
          <ContinueCard />
          <MyPatients />
          <div className="card flex flex-col gap-2 bg-gradient-to-br from-teal-700 to-teal-900 text-white ring-0">
            <p className="text-sm opacity-80">জ্বরের দিন অনুযায়ী ঝুঁকি</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div
                  key={d}
                  className={`flex h-14 flex-1 flex-col items-center justify-center rounded-lg text-sm font-bold ${d >= 3 ? "bg-red-600" : "bg-white/20"}`}
                >
                  <span className="text-[10px] font-normal opacity-80">
                    দিন
                  </span>
                  {d.toLocaleString("bn-BD")}
                </div>
              ))}
            </div>
            <p className="text-sm">
              <span className="font-bold">লাল অংশ = সংকটকাল।</span> এ সময়
              পেটব্যথা, বমি, রক্তপাত, ঝিমুনি দেখা দিলে সাথে সাথে হাসপাতাল।
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="card fade-up"
            style={{ animationDelay: `${200 + i * 80}ms` }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <f.icon className="size-6" aria-hidden />
            </div>
            <h3 className="mt-2 text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-sm text-slate-500">
        ডেঙ্গুসাথী রোগ নির্ণয় বা চিকিৎসা দেয় না। কখন ডাক্তার বা হাসপাতালে যেতে হবে,
        শুধু সেটি জানাতে সাহায্য করে। WHO-র নিয়ম সবসময় AI-এর উপরে।
      </p>
    </main>
  );
}
