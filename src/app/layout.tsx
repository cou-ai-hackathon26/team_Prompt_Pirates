import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";

import { AccountSync } from "~/app/_components/account";
import { AppHeader } from "~/app/_components/app-header";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "ডেঙ্গুসাথী | DengueSathi",
  description: "ডেঙ্গু রোগীর বাসায় পর্যবেক্ষণ ও সময়মতো হাসপাতালে পাঠানোর সহায়ক",
  icons: [
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn" className={hind.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only z-[2000] rounded-xl bg-white px-4 py-3 font-semibold text-teal-800 shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 print:hidden"
        >
          মূল অংশে যান
        </a>
        <TRPCReactProvider>
          <AppHeader />
          <AccountSync />
          <div id="main" tabIndex={-1} className="outline-none">
            {children}
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
