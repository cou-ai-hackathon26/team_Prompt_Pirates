"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { searchAreas } from "~/lib/area-search";
import {
  DISTRICTS,
  DIVISIONS,
  areasOfDistrict,
  getArea,
  getDistrict,
  getDivision,
  nearestArea,
  type Area,
} from "~/lib/areas";

export const LAST_AREA_KEY = "denguesathi.lastArea";
/** One-tap shortcuts for the demo regions. */
const POPULAR = ["noakhali.noakhali-sadar", "noakhali.sonapur", "dhaka.mirpur", "chattogram.kotwali"];

type GpsState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "error"; message: string };

function districtLine(a: Area) {
  const d = getDistrict(a.d);
  const v = d && getDivision(d.divisionId);
  return [d && `${d.bn} জেলা`, v && `${v.bn} বিভাগ`].filter(Boolean).join(" · ");
}

/**
 * Area picker for all of Bangladesh: GPS suggestion (only the area is kept, never the position),
 * forgiving Bangla / English / Banglish search, one-tap chips, and a district -> upazila list.
 */
export function AreaPicker({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (id: string) => void;
  error?: string | null;
}) {
  const selected = value ? getArea(value) : undefined;
  const [editing, setEditing] = useState(!selected);
  const [fromGps, setFromGps] = useState(false);
  const [gps, setGps] = useState<GpsState>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string | null>(null);
  const [browseDistrict, setBrowseDistrict] = useState<number | "">("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const last = localStorage.getItem(LAST_AREA_KEY);
    if (last && getArea(last)) setRecent(last);
  }, []);

  // Parent may set a value after mount (e.g. last-used area): show it as the selection.
  useEffect(() => {
    if (selected) setEditing(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => searchAreas(query), [query]);
  const chips = useMemo(
    () =>
      [...new Set([recent, ...POPULAR].filter((x): x is string => !!x))]
        .map((id) => getArea(id))
        .filter((a): a is Area => !!a)
        .slice(0, 4),
    [recent],
  );

  const choose = (a: Area, viaGps = false) => {
    onChange(a.id);
    setFromGps(viaGps);
    setEditing(false);
    setQuery("");
    setOpen(false);
    setGps({ kind: "idle" });
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGps({ kind: "error", message: "এই ফোনে লোকেশন পাওয়া যাচ্ছে না। নিচে নাম লিখে খুঁজুন।" });
      return;
    }
    setGps({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = nearestArea({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (hit) choose(hit.area, true);
        else
          setGps({
            kind: "error",
            message: "আপনার লোকেশন বাংলাদেশের বাইরে মনে হচ্ছে। নিচে এলাকার নাম লিখে খুঁজুন।",
          });
      },
      (err) =>
        setGps({
          kind: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "লোকেশনের অনুমতি দেওয়া হয়নি। নিচে এলাকার নাম লিখে খুঁজুন।"
              : "লোকেশন পাওয়া যায়নি। নিচে এলাকার নাম লিখে খুঁজুন।",
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected && !editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">এলাকা</span>
        <div className="flex items-center gap-3 rounded-xl border-2 border-teal-700 bg-teal-50 p-3">
          <MapPin className="size-6 shrink-0 text-teal-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-snug">{selected.bn}</p>
            <p className="text-sm text-slate-600">{districtLine(selected)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="btn-ghost min-h-11 shrink-0 px-3 text-teal-800"
          >
            বদলান
          </button>
        </div>
        {fromGps && (
          <span className="text-sm text-slate-600">
            আপনার লোকেশন থেকে বাছাই করা হয়েছে। ভুল হলে &ldquo;বদলান&rdquo; চাপুন।
          </span>
        )}
        <span className="text-xs text-slate-500">
          শুধু এলাকার নাম রাখা হয়, আপনার সঠিক ঠিকানা বা লোকেশন নয়।
        </span>
      </div>
    );
  }

  const showList = open && query.trim().length > 0;
  const browseAreas = browseDistrict === "" ? [] : areasOfDistrict(browseDistrict);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${listId}-label`} className="font-semibold">
          এলাকা (উপজেলা / থানা)
        </span>
        {selected && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-600"
          >
            <X className="size-4" aria-hidden /> বাতিল
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={locate}
        disabled={gps.kind === "locating"}
        className="btn-outline w-full justify-center gap-2"
      >
        {gps.kind === "locating" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="size-5" aria-hidden />
        )}
        {gps.kind === "locating" ? "এলাকা খোঁজা হচ্ছে..." : "আমার এলাকা খুঁজুন (লোকেশন)"}
      </button>
      {gps.kind === "error" && (
        <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          {gps.message}
        </p>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={`${listId}-label`}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="উপজেলা বা জেলার নাম লিখুন, যেমন: বেগমগঞ্জ / begumganj"
          className="input w-full pl-10"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-600">
                কোনো এলাকা পাওয়া যায়নি। জেলার নাম লিখে দেখুন, বা নিচের তালিকা থেকে বেছে নিন।
              </li>
            ) : (
              results.map((a, i) => (
                <li
                  key={a.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(a)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-1.5 ${i === active ? "bg-teal-50" : ""}`}
                >
                  <span className="font-semibold">
                    {a.bn} <span className="text-sm font-normal text-slate-500">({a.en})</span>
                  </span>
                  <span className="text-sm text-slate-600">{districtLine(a)}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="দ্রুত বাছাই">
          {chips.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => choose(a)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-slate-300 px-3.5 py-1 text-sm font-medium hover:border-teal-700"
            >
              {a.id === recent && <span className="text-xs text-teal-700">আগের:</span>}
              {a.bn}
              <span className="text-slate-500">· {getDistrict(a.d)?.bn}</span>
            </button>
          ))}
        </div>
      )}

      <details className="group rounded-xl border border-slate-200 px-3 py-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-700">
          তালিকা থেকে বেছে নিন (জেলা → উপজেলা)
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-2 pb-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            জেলা
            <select
              value={browseDistrict}
              onChange={(e) => setBrowseDistrict(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">জেলা বাছুন</option>
              {DIVISIONS.map((v) => (
                <optgroup key={v.id} label={`${v.bn} বিভাগ`}>
                  {DISTRICTS.filter((d) => d.divisionId === v.id)
                    .sort((a, b) => a.bn.localeCompare(b.bn, "bn"))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.bn}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            উপজেলা / থানা
            <select
              value=""
              disabled={browseDistrict === ""}
              onChange={(e) => {
                const a = getArea(e.target.value);
                if (a) choose(a);
              }}
              className="input disabled:opacity-50"
            >
              <option value="">{browseDistrict === "" ? "আগে জেলা বাছুন" : "উপজেলা বাছুন"}</option>
              {browseAreas
                .slice()
                .sort((a, b) => a.bn.localeCompare(b.bn, "bn"))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bn}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </details>

      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
