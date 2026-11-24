"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const LINKS = [
  {
    href: "/",
    label: "হোম",
    short: "হোম",
    match: (p: string) => p === "/" || p === "/new" || p.startsWith("/p/"),
  },
  {
    href: "/how-it-works",
    label: "কিভাবে কাজ করে",
    short: "কিভাবে",
    match: (p: string) => p.startsWith("/how-it-works"),
  },
  {
    href: "/dashboard",
    label: "হাসপাতাল ড্যাশবোর্ড",
    short: "ড্যাশবোর্ড",
    match: (p: string) => p.startsWith("/dashboard"),
  },
];

export function AppHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1000] border-b border-teal-800/20 bg-teal-700 text-white shadow-sm print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <Image
            src="/icon.svg"
            alt=""
            width={36}
            height={36}
            unoptimized
            className="h-9 w-9 rounded-xl ring-2 ring-white/40"
          />
          <span className="leading-tight">
            <span className="block text-lg font-bold">ডেঙ্গুসাথী</span>
            <span className="block text-[11px] tracking-wide opacity-80">
              DengueSathi
            </span>
          </span>
        </Link>
        <nav className="ml-auto flex gap-1 text-sm sm:text-base">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors sm:px-3 ${l.match(path) ? "bg-white/20" : "hover:bg-white/10"}`}
            >
              <span className="sm:hidden">{l.short}</span>
              <span className="hidden sm:inline">{l.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
