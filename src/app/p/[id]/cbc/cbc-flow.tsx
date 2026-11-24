"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AiProgress } from "~/app/_components/ai-progress";
import { Steps } from "~/app/_components/steps";
import { IdentityCheck, OtherPersonNotice } from "~/app/_components/identity-check";
import { blobToBase64 } from "~/lib/audio/toWav";
import { compressImage } from "~/lib/image/compress";
import { api } from "~/trpc/react";
import { friendlyError } from "~/lib/friendly-error";
import {
  Camera,
  Check,
  FileText,
  FlaskConical,
  ImageUp,
  PenLine,
} from "lucide-react";

interface Sample {
  id: string;
  title: string;
}

type Values = {
  plateletUl: string;
  hctPct: string;
  wbcUl: string;
  hbGdl: string;
};
const EMPTY: Values = { plateletUl: "", hctPct: "", wbcUl: "", hbGdl: "" };

const FIELDS: {
  key: keyof Values;
  label: string;
  unit: string;
  min: number;
  max: number;
  hint: string;
  reject: string;
}[] = [
  {
    key: "plateletUl",
    label: "প্লাটিলেট",
    unit: "/µL",
    min: 1_000,
    max: 1_500_000,
    hint: "যেমন ১৫০০০০",
    reject: "platelet",
  },
  {
    key: "hctPct",
    label: "হেমাটোক্রিট (HCT/PCV)",
    unit: "%",
    min: 10,
    max: 70,
    hint: "যেমন ৪০",
    reject: "hematocrit",
  },
  {
    key: "wbcUl",
    label: "WBC",
    unit: "/µL",
    min: 300,
    max: 100_000,
    hint: "যেমন ৫০০০",
    reject: "wbc",
  },
  {
    key: "hbGdl",
    label: "হিমোগ্লোবিন",
    unit: "g/dL",
    min: 3,
    max: 22,
    hint: "যেমন ১৩",
    reject: "hemoglobin",
  },
];

/** Server accepts up to 3,000,000 base64 chars, i.e. about 2.2 MB of file. */
const MAX_PDF_BYTES = 2_100_000;
const PDF_PREVIEW = "pdf";

const todayIso = () =>
  new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

export function CbcFlow({
  patientId,
  patientName,
  feverStartIso,
  samples,
}: {
  patientId: string;
  patientName: string;
  feverStartIso: string;
  samples: Sample[];
}) {
  const router = useRouter();
  // Two inputs: the camera (capture) for a fresh photo, and the normal picker for a saved photo,
  // screenshot, WhatsApp image or PDF report. A single capture input forced the camera on phones.
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState<{
    rejected: string[];
    lowConfidence: boolean;
    notCbc: boolean;
    lab: string | null;
  }>({
    rejected: [],
    lowConfidence: false,
    notCbc: false,
    lab: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  // Sample reports carry fictional printed dates; never use them as the result date.
  const [fromSample, setFromSample] = useState(false);
  // Patient details printed on the report, checked against the profile on save.
  const [printed, setPrinted] = useState<{
    name: string | null;
    ageRaw: string | null;
    sexRaw: string | null;
  } | null>(null);
  type SaveInput = Parameters<typeof save.mutate>[0];
  const lastSave = useRef<SaveInput | null>(null);

  const extract = api.cbc.extract.useMutation({
    onSuccess: ({ raw, values: v }) => {
      if (!raw.isCbcReport) {
        setNotes({
          rejected: [],
          lowConfidence: false,
          notCbc: true,
          lab: raw.labName,
        });
        setValues(null);
        return;
      }
      setValues({
        plateletUl: v.plateletUl?.toString() ?? "",
        hctPct: v.hctPct?.toString() ?? "",
        wbcUl: v.wbcUl?.toString() ?? "",
        hbGdl: v.hbGdl?.toString() ?? "",
      });
      setNotes({
        rejected: v.rejected,
        lowConfidence: raw.confidence === "low",
        notCbc: false,
        lab: raw.labName,
      });
      setPrinted({
        name: raw.patientName,
        ageRaw: raw.patientAgeRaw,
        sexRaw: raw.patientSexRaw,
      });
      // Use the printed report date only if it fits this illness (not before the fever, not in the future).
      if (
        !fromSample &&
        raw.reportDate &&
        raw.reportDate >= feverStartIso.slice(0, 10) &&
        raw.reportDate <= todayIso()
      )
        setDate(raw.reportDate);
    },
    onError: (e) => {
      setError(friendlyError(e));
      setValues(EMPTY);
    },
  });

  const save = api.cbc.save.useMutation({
    onSuccess: (r) => {
      if (r.outcome !== "saved") return; // held / rejected are shown below
      router.push(`/p/${patientId}?updated=1`);
      router.refresh();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const handleFile = async (file: File) => {
    setFromSample(false);
    setError(null);
    setValues(null);
    setNotes({ rejected: [], lowConfidence: false, notCbc: false, lab: null });
    setPrinted(null);
    try {
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        if (file.size > MAX_PDF_BYTES) {
          setError(
            "PDF ফাইলটি খুব বড় (২ MB-এর বেশি)। রিপোর্টের পাতার একটি ছবি বা স্ক্রিনশট দিন।",
          );
          return;
        }
        const base64 = await blobToBase64(file);
        setPreview(PDF_PREVIEW);
        setPdfName(file.name);
        extract.mutate({ imageBase64: base64, mimeType: "application/pdf" });
        return;
      }
      setPdfName(null);
      const { base64, mimeType } = await compressImage(file);
      setPreview(`data:${mimeType};base64,${base64}`);
      extract.mutate({ imageBase64: base64, mimeType });
    } catch {
      setError("ছবিটি খোলা যায়নি। অন্য ছবি দিন।");
    }
  };

  const loadSample = async (id: string) => {
    setShowSamples(false);
    setFromSample(true);
    setDate(todayIso());
    const res = await fetch(`/samples/cbc/${id}-photo.png`);
    const blob = await res.blob();
    // Send the sample exactly as stored (no re-compression): identical bytes -> AI cache hit,
    // so the stage demo answers instantly even if the free AI tier is slow (see scripts/warm-demo.mjs).
    setError(null);
    setValues(null);
    setNotes({ rejected: [], lowConfidence: false, notCbc: false, lab: null });
    setPrinted(null);
    const base64 = await blobToBase64(blob);
    setPreview(`data:image/png;base64,${base64}`);
    extract.mutate({ imageBase64: base64, mimeType: "image/png" });
  };

  const fieldError = (f: (typeof FIELDS)[number], v: string) => {
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= f.min && n <= f.max
      ? null
      : `${f.min.toLocaleString("en-IN")} থেকে ${f.max.toLocaleString("en-IN")} এর মধ্যে হতে হবে`;
  };
  const anyValue = values && Object.values(values).some((v) => v !== "");
  const anyError = values && FIELDS.some((f) => fieldError(f, values[f.key]));

  const resetAll = () => {
    save.reset();
    setPreview(null);
    setValues(null);
    setPrinted(null);
    setError(null);
  };
  const answer = (identityAnswer: "same" | "other") =>
    lastSave.current && save.mutate({ ...lastSave.current, identityAnswer });

  if (save.data?.outcome === "held")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={["ছবি দিন", "মিলিয়ে নিন", "ফলাফল"]} current={1} />
        <IdentityCheck
          patientName={patientName}
          what="report"
          conflicts={save.data.conflicts}
          busy={save.isPending}
          onSame={() => answer("same")}
          onOther={() => answer("other")}
        />
      </div>
    );
  if (save.data?.outcome === "rejected")
    return (
      <OtherPersonNotice
        what="report"
        dangerIfOther={save.data.dangerIfOther}
        patientId={patientId}
        onRetry={resetAll}
      />
    );

  if (save.isPending || save.data?.outcome === "saved")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={["ছবি দিন", "মিলিয়ে নিন", "ফলাফল"]} current={2} />
        <AiProgress
          title="ঝুঁকি যাচাই হচ্ছে"
          stages={[
            "প্লাটিলেট ও হেমাটোক্রিটের ট্রেন্ড হিসাব",
            "WHO সতর্কসংকেত নিয়ম যাচাই",
            "বাংলায় পরামর্শ তৈরি",
          ]}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <Steps
        steps={["ছবি দিন", "মিলিয়ে নিন", "ফলাফল"]}
        current={values ? 1 : 0}
      />
      {!preview && !values && (
        <div className="card flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <FlaskConical className="size-10" aria-hidden />
          </span>
          <p className="text-lg text-slate-600">
            CBC রিপোর্টটি সমান জায়গায় রেখে, আলোতে, পুরো কাগজের ছবি তুলুন।
          </p>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              className="btn-primary"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-5" aria-hidden /> ছবি তুলুন
            </button>
            <button
              className="btn-primary"
              onClick={() => fileRef.current?.click()}
            >
              <ImageUp className="size-5" aria-hidden /> ফাইল / গ্যালারি
            </button>
          </div>
          <p className="-mt-2 text-sm text-slate-600">
            ফোনে থাকা ছবি, স্ক্রিনশট, WhatsApp-এ পাওয়া রিপোর্ট বা PDF ফাইলও দিতে
            পারেন।
          </p>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              className="btn-outline"
              onClick={() => setShowSamples((v) => !v)}
            >
              <FileText className="size-5" aria-hidden /> নমুনা রিপোর্ট
            </button>
            <button className="btn-outline" onClick={() => setValues(EMPTY)}>
              <PenLine className="size-5" aria-hidden /> হাতে লিখুন
            </button>
          </div>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="ক্যামেরা দিয়ে রিপোর্টের ছবি তুলুন"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        aria-label="ফোন থেকে রিপোর্টের ছবি বা PDF বেছে নিন"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {showSamples && (
        <div className="card fade-up">
          <p className="mb-3 text-sm text-slate-600">
            ডেমোর জন্য বানানো নমুনা রিপোর্ট (কাল্পনিক ল্যাব ও রোগী)
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => void loadSample(s.id)}
                className="overflow-hidden rounded-xl text-left ring-1 ring-slate-200 hover:ring-2 hover:ring-teal-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/samples/cbc/${s.id}-photo.png`}
                  alt={s.title}
                  className="h-32 w-full object-cover object-top"
                />
                <p className="p-2 text-xs leading-snug">{s.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="card relative overflow-hidden !p-0">
          {preview === PDF_PREVIEW ? (
            <div
              className={`flex h-40 flex-col items-center justify-center gap-2 bg-slate-50 ${extract.isPending ? "opacity-60" : ""}`}
            >
              <FileText className="size-12 text-red-600" aria-hidden />
              <p className="max-w-[90%] truncate font-semibold">
                {pdfName ?? "PDF রিপোর্ট"}
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="রিপোর্টের ছবি"
              className={`max-h-72 w-full object-contain ${extract.isPending ? "opacity-60" : ""}`}
            />
          )}
          {extract.isPending && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1 animate-[scan_1.8s_ease-in-out_infinite] bg-teal-500 shadow-[0_0_18px_6px_rgba(20,184,166,.55)]"
            />
          )}
        </div>
      )}

      {extract.isPending && (
        <AiProgress
          title="AI রিপোর্ট পড়ছে"
          stages={[
            "ছবি পাঠানো হচ্ছে",
            "রিপোর্টের ফলাফল কলাম পড়া",
            "একক রূপান্তর ও সংখ্যা যাচাই",
          ]}
        />
      )}

      {notes.notCbc && (
        <div className="card bg-yellow-50 ring-yellow-300">
          <p className="font-bold text-yellow-900">
            এটি CBC রিপোর্ট মনে হচ্ছে না।
          </p>
          <p className="text-yellow-900">
            প্লাটিলেট ও হেমাটোক্রিট আছে এমন রক্ত পরীক্ষার (CBC) রিপোর্টের ছবি দিন।
          </p>
          <button
            className="btn-outline mt-3"
            onClick={() => {
              setPreview(null);
              setNotes({ ...notes, notCbc: false });
            }}
          >
            অন্য ছবি দিন
          </button>
        </div>
      )}

      {values && (
        <div className="card fade-up flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {preview ? "AI যা পড়েছে, মিলিয়ে নিন" : "রিপোর্ট থেকে মানগুলো লিখুন"}
            </h2>
            {notes.lab && (
              <p className="text-sm text-slate-500">ল্যাব: {notes.lab}</p>
            )}
            {notes.lowConfidence && (
              <p className="mt-1 rounded-lg bg-yellow-50 p-2 text-sm text-yellow-900">
                ছবিটি পুরো পরিষ্কার নয়। প্রতিটি সংখ্যা রিপোর্টের সাথে মিলিয়ে নিন।
              </p>
            )}
          </div>
          {FIELDS.map((f) => {
            const err = fieldError(f, values[f.key]);
            const rejected = notes.rejected.includes(f.reject);
            return (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="font-semibold">
                  {f.label}{" "}
                  <span className="font-normal text-slate-500">({f.unit})</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[f.key]}
                  placeholder={f.hint}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                  className={`input ${err || rejected ? "border-red-500" : ""}`}
                />
                {f.key === "plateletUl" && values.plateletUl && !err && (
                  <span className="text-sm text-slate-600">
                    ={" "}
                    {(Number(values.plateletUl) / 1000).toLocaleString("bn-BD")}{" "}
                    হাজার
                  </span>
                )}
                {err && <span className="text-sm text-red-600">{err}</span>}
                {rejected && !values[f.key] && (
                  <span className="text-sm text-red-600">
                    AI যে সংখ্যা পড়েছে তা অসম্ভব মনে হচ্ছে। রিপোর্ট দেখে লিখুন।
                  </span>
                )}
              </label>
            );
          })}
          <label className="flex flex-col gap-1">
            <span className="font-semibold">রিপোর্টের তারিখ</span>
            <input
              type="date"
              value={date}
              min={feverStartIso.slice(0, 10)}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
          )}
          <button
            className="btn-primary"
            disabled={!anyValue || !!anyError || save.isPending}
            onClick={() => {
              const num = (v: string) => (v === "" ? null : Number(v));
              const takenAt =
                date === todayIso()
                  ? new Date()
                  : new Date(`${date}T10:00:00+06:00`);
              const payload: SaveInput = {
                patientId,
                takenAt,
                printed: printed ?? undefined,
                plateletUl:
                  num(values.plateletUl) != null
                    ? Math.round(num(values.plateletUl)!)
                    : null,
                hctPct: num(values.hctPct),
                wbcUl:
                  num(values.wbcUl) != null
                    ? Math.round(num(values.wbcUl)!)
                    : null,
                hbGdl: num(values.hbGdl),
              };
              lastSave.current = payload;
              save.mutate(payload);
            }}
          >
            {save.isPending ? (
              "ঝুঁকি যাচাই হচ্ছে..."
            ) : (
              <>
                <Check className="size-5" aria-hidden /> নিশ্চিত করুন ও ফলাফল দেখুন
              </>
            )}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setPreview(null);
              setValues(null);
              setError(null);
            }}
          >
            অন্য ছবি দিন
          </button>
        </div>
      )}

      {error && !values && (
        <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
      )}
      <p className="text-center text-xs text-slate-500">
        রিপোর্টের ছবি সংরক্ষণ করা হয় না, শুধু সংখ্যাগুলো রাখা হয়।
      </p>
      <Link
        href={`/p/${patientId}`}
        className="text-center text-slate-500 underline"
      >
        বাতিল
      </Link>
    </div>
  );
}
