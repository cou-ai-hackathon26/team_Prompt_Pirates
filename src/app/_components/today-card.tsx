import {
  BellRing,
  CircleCheck,
  Circle,
  FlaskConical,
  GlassWater,
  Mic,
} from "lucide-react";
import Link from "next/link";
import { toBn } from "~/lib/bn";

interface Item {
  done: boolean;
  icon: typeof Mic;
  title: string;
  detail: string;
  href?: string;
  download?: boolean;
  cta?: string;
}

/**
 * "আজকের করণীয়": what the family should do today, with one tap each.
 * Server-rendered from data the page already has; the reminder item downloads an .ics calendar file
 * so the phone itself reminds the family twice a day through the critical phase.
 */
export function TodayCard({
  patientId,
  dayOfFever,
  checkedInToday,
  fluidsPct,
  hoursSinceLastLab,
}: {
  patientId: string;
  dayOfFever: number;
  checkedInToday: boolean;
  fluidsPct: number | null;
  hoursSinceLastLab: number | null;
}) {
  const critical = dayOfFever >= 3 && dayOfFever <= 7;
  const items: Item[] = [
    {
      done: checkedInToday,
      icon: Mic,
      title: "আজকের আপডেট",
      detail: checkedInToday
        ? "দেওয়া হয়েছে"
        : critical
          ? "সংকটকালে প্রতিদিন অন্তত একবার, সম্ভব হলে সকাল-রাত দুবার"
          : "দিনে একবার কথা বলে জানান",
      href: `/p/${patientId}/checkin`,
      cta: checkedInToday ? undefined : "দিন",
    },
    {
      done: fluidsPct != null && fluidsPct >= 1,
      icon: GlassWater,
      title: "তরল খাওয়া",
      detail:
        fluidsPct == null
          ? "আজ এখনও কিছু লেখা হয়নি, নিচে গ্লাস যোগ করুন"
          : fluidsPct >= 1
            ? "আজকের লক্ষ্য পূরণ হয়েছে"
            : `লক্ষ্যের ${toBn(Math.round(fluidsPct * 100))}% হয়েছে`,
      href: "#fluids",
    },
    {
      done: hoursSinceLastLab != null && hoursSinceLastLab < 24,
      icon: FlaskConical,
      title: "রক্ত পরীক্ষা (CBC)",
      detail:
        hoursSinceLastLab == null
          ? "কোনো রিপোর্ট নেই। ডাক্তার CBC করালে ছবি দিন"
          : hoursSinceLastLab < 24
            ? "গত ২৪ ঘণ্টার রিপোর্ট দেওয়া আছে"
            : `শেষ রিপোর্ট ${toBn(Math.floor(hoursSinceLastLab / 24))} দিন আগে। ${critical ? "সংকটকালে ডাক্তার সাধারণত প্রতিদিন CBC করান" : "নতুন রিপোর্ট থাকলে ছবি দিন"}`,
      href: `/p/${patientId}/cbc`,
    },
  ];

  return (
    <section className="card" aria-labelledby="today-title">
      <h2 id="today-title" className="mb-2 text-lg font-bold">
        আজকের করণীয়
      </h2>
      <ul className="flex flex-col divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.title}>
            <Link
              href={it.href ?? "#"}
              className="flex min-h-14 items-center gap-3 rounded-xl py-2 transition-colors hover:bg-slate-50"
            >
              {it.done ? (
                <CircleCheck
                  className="size-6 shrink-0 text-green-700"
                  aria-label="সম্পন্ন"
                />
              ) : (
                <Circle
                  className="size-6 shrink-0 text-slate-400"
                  aria-label="বাকি"
                />
              )}
              <it.icon className="size-5 shrink-0 text-teal-700" aria-hidden />
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-semibold ${it.done ? "text-slate-600" : ""}`}
                >
                  {it.title}
                </span>
                <span className="block text-sm text-slate-600">
                  {it.detail}
                </span>
              </span>
              {it.cta && (
                <span className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
                  {it.cta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <a
        href={`/p/${patientId}/reminders.ics`}
        download
        className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-700/50 px-3 py-2 text-center font-semibold text-teal-800 transition-colors hover:bg-teal-50"
      >
        <BellRing className="size-5 shrink-0" aria-hidden />
        ফোনের ক্যালেন্ডারে রিমাইন্ডার যোগ করুন (প্রতিদিন সকাল ৯টা ও রাত ৮টা, ৭ম দিন
        পর্যন্ত)
      </a>
    </section>
  );
}
