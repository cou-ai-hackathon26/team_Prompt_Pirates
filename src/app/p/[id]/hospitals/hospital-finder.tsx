"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MapPoint } from "~/app/_components/leaflet-map";
import { directionsUrl } from "~/lib/geo";
import { toBn } from "~/lib/symptom-labels";
import { api } from "~/trpc/react";
import { ClipboardList, MapPin, Navigation, Phone } from "lucide-react";

const LeafletMap = dynamic(() => import("~/app/_components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
  ),
});

export function HospitalFinder({
  patientId,
  area,
  status,
}: {
  patientId: string;
  area: string;
  status: string;
}) {
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const q = api.hospital.nearest.useQuery({
    area,
    lat: gps?.lat,
    lng: gps?.lng,
    limit: 6,
  });

  const locate = () => {
    if (!navigator.geolocation)
      return setGpsError("এই ফোনে অবস্থান পাওয়া যাচ্ছে না");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setGpsError(
          "অবস্থানের অনুমতি পাওয়া যায়নি, এলাকার কেন্দ্র থেকে দূরত্ব দেখানো হচ্ছে",
        );
        setLocating(false);
      },
      { timeout: 10000 },
    );
  };

  const points = useMemo<MapPoint[]>(() => {
    if (!q.data) return [];
    return [
      {
        id: "me",
        lat: q.data.origin.lat,
        lng: q.data.origin.lng,
        label: gps ? "আপনি এখানে" : "আপনার এলাকা",
        color: "#2563eb",
        radius: 8,
        highlight: true,
      },
      ...q.data.hospitals.map((h, i) => ({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        label: `${toBn(i + 1)}. ${h.nameBn ?? h.name}`,
        color: h.isPublic ? "#dc2626" : "#f97316",
        highlight: i === 0,
      })),
    ];
  }, [q.data, gps]);

  return (
    <div className="flex flex-col gap-4">
      {status === "RED" && (
        <div className="card bg-red-600 text-white ring-0">
          <p className="text-xl font-bold">এখনই রোগীকে হাসপাতালে নিন</p>
          <p className="mt-1">
            পথে অল্প অল্প করে ওরস্যালাইন বা পানি খাওয়ান। জরুরি অ্যাম্বুলেন্স: ৯৯৯
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="tel:999" className="btn bg-white text-red-700">
              <Phone className="size-5" aria-hidden /> অ্যাম্বুলেন্স ৯৯৯
            </a>
            <a href="tel:16263" className="btn bg-white/20 text-white">
              ডাক্তারের পরামর্শ ১৬২৬৩
            </a>
          </div>
          <Link
            href={`/p/${patientId}/handoff`}
            className="btn mt-2 w-full border-2 border-white/70 text-white hover:bg-white/10"
          >
            <ClipboardList className="size-5" aria-hidden /> ডাক্তারের জন্য সারাংশ
            দেখান
          </Link>
        </div>
      )}

      {q.data?.farAway && (
        <div role="status" className="card bg-amber-50 ring-amber-300">
          <p className="font-bold text-amber-900">
            আপনার কাছে ২৫ কিলোমিটারের মধ্যে কোনো হাসপাতাল আমাদের তালিকায় নেই
          </p>
          <p className="mt-1 text-amber-900">
            তালিকা অসম্পূর্ণ হতে পারে। নিকটতম উপজেলা স্বাস্থ্য কমপ্লেক্সে যান। কোথায় যাবেন
            জানতে ১৬২৬৩, অবস্থা খারাপ হলে বা কেউ কল না ধরলে ৯৯৯:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="tel:16263" className="btn-primary">
              <Phone className="size-5" aria-hidden /> ডাক্তারের পরামর্শ ১৬২৬৩
            </a>
            <a href="tel:999" className="btn-outline">
              অ্যাম্বুলেন্স ৯৯৯
            </a>
          </div>
        </div>
      )}

      <div className="card !p-3">
        {q.isLoading ? (
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
        ) : (
          <LeafletMap points={points} />
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">
            <span className="inline-block h-3 w-3 rounded-full bg-red-600" />{" "}
            সরকারি/জরুরি{" "}
            <span className="ml-2 inline-block h-3 w-3 rounded-full bg-orange-500" />{" "}
            অন্যান্য
          </span>
          {!gps && (
            <button
              onClick={locate}
              disabled={locating}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-blue-50 px-4 font-semibold text-blue-800 transition-colors hover:bg-blue-100"
            >
              {locating ? (
                "খুঁজছে..."
              ) : (
                <>
                  <MapPin className="size-4" aria-hidden /> আমার অবস্থান
                </>
              )}
            </button>
          )}
        </div>
        {gpsError && <p className="mt-1 text-xs text-slate-500">{gpsError}</p>}
      </div>

      <ol className="flex flex-col gap-3">
        {q.data?.hospitals.map((h, i) => (
          <li
            key={h.id}
            className={`card flex flex-col gap-2 !p-4 ${i === 0 ? "ring-2 ring-red-500" : ""}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white ${h.isPublic ? "bg-red-600" : "bg-orange-500"}`}
              >
                {toBn(i + 1)}
              </span>
              <div className="flex-1">
                <p className="leading-snug font-bold">{h.nameBn ?? h.name}</p>
                {h.nameBn && <p className="text-sm text-slate-500">{h.name}</p>}
                <p className="text-sm text-slate-600">
                  প্রায়{" "}
                  {h.distanceKm.toLocaleString("bn-BD", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  কিমি দূরে
                  {h.isPublic && (
                    <span className="ml-2 rounded bg-red-50 px-1.5 text-xs font-semibold text-red-700">
                      সরকারি
                    </span>
                  )}
                  {h.emergency && (
                    <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs font-semibold">
                      জরুরি বিভাগ
                    </span>
                  )}
                  {h.approx && (
                    <span className="ml-1 text-xs text-slate-500">
                      (আনুমানিক অবস্থান)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={directionsUrl(h.lat, h.lng)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary !py-2 !text-base"
              >
                <Navigation className="size-5" aria-hidden /> পথ দেখুন
              </a>
              {h.phone ? (
                <a
                  href={`tel:${h.phone.split(/[;,]/)[0]!.trim()}`}
                  className="btn-outline !py-2 !text-base"
                >
                  <Phone className="size-5" aria-hidden /> কল করুন
                </a>
              ) : (
                <a href="tel:999" className="btn-outline !py-2 !text-base">
                  <Phone className="size-5" aria-hidden /> ৯৯৯
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      {q.error && (
        <p className="rounded-xl bg-red-50 p-3 text-red-700">
          হাসপাতালের তালিকা আনা যায়নি। জরুরি প্রয়োজনে ৯৯৯ এ কল করুন।
        </p>
      )}
      <p className="text-center text-xs text-slate-500">
        হাসপাতালের তথ্য OpenStreetMap থেকে নেওয়া; যাওয়ার আগে ফোনে নিশ্চিত হয়ে নিন।
      </p>
      <Link
        href={`/p/${patientId}`}
        className="text-center text-slate-500 underline"
      >
        ← রোগীর পাতায় ফিরুন
      </Link>
    </div>
  );
}
