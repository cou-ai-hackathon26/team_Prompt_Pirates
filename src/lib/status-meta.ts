import type { Status } from "~/lib/risk/who-rules";

/** Shared by server and client components (must not live in a "use client" file). */
export const STATUS_META: Record<Status, { title: string; sub: string; icon: string; bg: string; ring: string; text: string }> = {
  GREEN: { title: "সবুজ", sub: "বাসায় যত্ন চালিয়ে যান", icon: "✓", bg: "bg-risk-green", ring: "ring-green-200", text: "text-green-700" },
  YELLOW: { title: "হলুদ", sub: "আজই ডাক্তার দেখান", icon: "!", bg: "bg-risk-yellow", ring: "ring-yellow-200", text: "text-yellow-700" },
  RED: { title: "লাল", sub: "এখনই হাসপাতালে যান", icon: "‼", bg: "bg-risk-red", ring: "ring-red-200", text: "text-red-700" },
};
