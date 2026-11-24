"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiProgress } from "~/app/_components/ai-progress";
import { Steps } from "~/app/_components/steps";
import { IdentityCheck, OtherPersonNotice } from "~/app/_components/identity-check";
import { SymptomEditor } from "~/app/_components/symptom-editor";
import { VoiceVisualizer } from "~/app/_components/voice-visualizer";
import {
  MAX_RECORD_SECONDS,
  RECORD_WARN_SECONDS,
  useRecorder,
} from "~/app/_components/use-recorder";
import {
  emptyMentioned,
  emptySymptoms,
  type Mentioned,
  type Symptoms,
  type TimelineItem,
} from "~/lib/ai/schemas";
import { blobToBase64, blobToWav16k } from "~/lib/audio/toWav";
import { blobToMp3 } from "~/lib/audio/toMp3";
import { toBn } from "~/lib/symptom-labels";
import { api } from "~/trpc/react";
import { friendlyError } from "~/lib/friendly-error";
import { Check, Keyboard, ListChecks, Mic, Square } from "lucide-react";

type Step = "speak" | "processing" | "confirm";
const WHEN_BN: Record<TimelineItem["when"], string> = {
  morning: "সকাল",
  noon: "দুপুর",
  afternoon: "বিকেল",
  evening: "সন্ধ্যা",
  night: "রাত",
  now: "এখন",
  unspecified: "আজ",
};
const STEP_LABELS = ["বলুন", "মিলিয়ে নিন", "ফলাফল"];

const EXAMPLES = [
  // A whole-day summary: the morning bleeding must stay even though it "stopped" (-> RED).
  "সকালে জ্বর ১০৩ ছিল, দুইবার বমি করছে। দুপুরে দাঁত দিয়ে একটু রক্ত পড়ছিল, এখন বন্ধ। বিকেল থেকে জ্বর নেই, পানি খাচ্ছে।",
  "জ্বর কমে গেছে কিন্তু পেটে খুব ব্যথা, আজকে দুইবার বমি করছে",
  "জ্বর ১০২, পানি খাচ্ছে, বমি নেই, পেটে ব্যথা নেই",
  "সকাল থেকে প্রস্রাব হয়নি, খুব ঝিমাচ্ছে, দাঁত দিয়ে রক্ত পড়ছে",
];

export function CheckinFlow({
  patientId,
  patientName,
  dayOfFever,
}: {
  patientId: string;
  patientName: string;
  dayOfFever: number;
}) {
  const router = useRouter();
  const rec = useRecorder();
  const [step, setStep] = useState<Step>("speak");
  const [symptoms, setSymptoms] = useState<Symptoms>(emptySymptoms);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [unclear, setUnclear] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [mentioned, setMentioned] = useState<Mentioned>(emptyMentioned);
  const [source, setSource] = useState<"VOICE" | "FORM">("VOICE");
  const [typed, setTyped] = useState("");
  const [showType, setShowType] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExtracted = (r: {
    transcriptBn: string;
    symptoms: Symptoms;
    unclearFields: string[];
    timeline: TimelineItem[];
    mentioned: Mentioned;
  }) => {
    setSymptoms(r.symptoms);
    setTimeline(r.timeline);
    setMentioned(r.mentioned);
    setTranscript(r.transcriptBn);
    setUnclear(r.unclearFields);
    setSource("VOICE");
    setStep("confirm");
  };
  const onFail = (e: { message: string }) => {
    setError(friendlyError(e));
    setStep("speak");
  };
  const voice = api.checkin.extractVoice.useMutation({
    onSuccess: (r) => onExtracted(r.value),
    onError: onFail,
  });
  const text = api.checkin.extractText.useMutation({
    onSuccess: (r) => onExtracted(r.value),
    onError: onFail,
  });
  const save = api.checkin.save.useMutation({
    onSuccess: (r) => {
      if (r.outcome !== "saved") return; // held / rejected are shown below
      router.push(`/p/${patientId}?updated=1`);
      router.refresh();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  // When recording finishes: compress to 16 kHz MP3 (WAV if the encoder fails) and send.
  useEffect(() => {
    if (rec.state !== "done" || !rec.blob) return;
    if (rec.elapsed < 1) {
      setError("রেকর্ডিং খুব ছোট। আবার চেষ্টা করুন।");
      rec.reset();
      return;
    }
    setStep("processing");
    setError(null);
    void (async () => {
      try {
        let audio: Blob;
        try {
          audio = await blobToMp3(rec.blob!);
        } catch {
          audio = await blobToWav16k(rec.blob!);
        }
        voice.mutate({
          audioBase64: await blobToBase64(audio),
          mimeType: audio.type === "audio/mpeg" ? "audio/mpeg" : "audio/wav",
        });
      } catch {
        onFail({
          message: "অডিও প্রসেস করা যায়নি। আবার বলুন বা ফর্ম ব্যবহার করুন।",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, rec.blob]);

  const openForm = () => {
    setSymptoms(emptySymptoms);
    setTranscript(null);
    setUnclear([]);
    setTimeline([]);
    setMentioned(emptyMentioned);
    setSource("FORM");
    setError(null);
    setStep("confirm");
  };

  if (step === "processing")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={STEP_LABELS} current={1} />
        <AiProgress
          title="AI আপনার কথা বুঝছে"
          stages={[
            "কথা পাঠানো হচ্ছে",
            "বাংলা কথা লেখায় রূপান্তর",
            "উপসর্গ খুঁজে বের করা",
          ]}
        />
      </div>
    );

  const submit = (identityAnswer?: "same" | "other") =>
    save.mutate({
      patientId,
      source,
      transcript: transcript ?? undefined,
      symptoms,
      mentioned: source === "VOICE" ? mentioned : undefined,
      identityAnswer,
    });

  if (save.data?.outcome === "held")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={STEP_LABELS} current={1} />
        <IdentityCheck
          patientName={patientName}
          what="voice"
          conflicts={save.data.conflicts}
          busy={save.isPending}
          onSame={() => submit("same")}
          onOther={() => submit("other")}
        />
      </div>
    );
  if (save.data?.outcome === "rejected")
    return (
      <OtherPersonNotice
        what="voice"
        dangerIfOther={save.data.dangerIfOther}
        patientId={patientId}
        onRetry={() => {
          save.reset();
          rec.reset();
          setStep("speak");
        }}
      />
    );

  // While the risk check runs (and while navigating to the result), show what is being checked.
  if (save.isPending || save.data?.outcome === "saved")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={STEP_LABELS} current={2} />
        <AiProgress
          title="ঝুঁকি যাচাই হচ্ছে"
          stages={[
            "WHO সতর্কসংকেত নিয়ম যাচাই",
            "AI দিয়ে কয়েক দিনের ট্রেন্ড দেখা",
            "বাংলায় পরামর্শ তৈরি",
          ]}
        />
      </div>
    );

  if (step === "confirm")
    return (
      <div className="flex flex-col gap-4">
        <Steps steps={STEP_LABELS} current={1} />
        {transcript && (
          <div className="card fade-up bg-teal-50 ring-teal-200">
            <p className="text-sm font-semibold text-teal-800">
              <Mic className="inline size-4 align-[-2px]" aria-hidden /> AI যা
              শুনেছে
            </p>
            <p className="mt-1 text-lg">&ldquo;{transcript}&rdquo;</p>
            {timeline.length > 1 && (
              <div className="mt-3 border-t border-teal-200 pt-3">
                <p className="text-sm font-semibold text-teal-800">
                  সারা দিনের হিসাব (AI যেভাবে বুঝেছে)
                </p>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {timeline.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-16 shrink-0 rounded-md bg-white px-2 py-0.5 text-center text-sm font-semibold text-teal-800">
                        {WHEN_BN[t.when]}
                      </span>
                      <span>{t.noteBn}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-600">
                  দিনের যেকোনো সময় বিপদচিহ্ন থাকলে, এখন ভালো থাকলেও সেটা ধরা হয়।
                </p>
              </div>
            )}
            {unclear.length > 0 && (
              <p className="mt-2 text-sm text-yellow-800">
                হলুদ দাগ দেওয়া বিষয়গুলো পরিষ্কার বোঝা যায়নি, একবার দেখে নিন।
              </p>
            )}
          </div>
        )}
        <div className="card fade-up">
          <h2 className="mb-4 text-xl font-bold">
            {transcript ? "ঠিক আছে কিনা মিলিয়ে নিন" : "আজকের উপসর্গ বেছে নিন"}
          </h2>
          <SymptomEditor
            value={symptoms}
            onChange={setSymptoms}
            highlight={unclear}
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            className="btn-ghost"
            onClick={() => {
              rec.reset();
              setStep("speak");
            }}
          >
            ← আবার বলুন
          </button>
          <button
            className="btn-primary flex-1"
            disabled={save.isPending}
            onClick={() => submit()}
          >
            {save.isPending ? (
              "ঝুঁকি যাচাই হচ্ছে..."
            ) : (
              <>
                <Check className="size-5" aria-hidden /> নিশ্চিত করুন ও ফলাফল দেখুন
              </>
            )}
          </button>
        </div>
      </div>
    );

  // step === "speak"
  const recording = rec.state === "recording";
  return (
    <div className="flex flex-col gap-4">
      <Steps steps={STEP_LABELS} current={0} />
      <div className="card flex flex-col items-center gap-5 py-8 text-center">
        <p className="text-lg text-slate-600">
          জ্বরের {toBn(dayOfFever)} নম্বর দিন। সকাল থেকে এখন পর্যন্ত সারা দিন
          রোগী কেমন ছিল, একবারে নিজের ভাষায় বলুন (২ মিনিট পর্যন্ত)।
        </p>
        <ul className="text-left text-sm text-slate-500">
          <li>• জ্বর কত ছিল? এখন কমেছে কি?</li>
          <li>• সারা দিনে কতবার বমি হয়েছে?</li>
          <li>• বমি, পেটব্যথা, রক্তপাত আছে কি?</li>
          <li>• পানি খেতে পারছে? প্রস্রাব হচ্ছে?</li>
        </ul>

        <button
          onClick={recording ? rec.stop : rec.start}
          aria-label={recording ? "থামান" : "বলা শুরু করুন"}
          className={`relative flex h-36 w-36 items-center justify-center rounded-full text-6xl text-white shadow-xl transition active:scale-95 ${recording ? "bg-red-600" : "bg-teal-700 hover:bg-teal-800"}`}
        >
          {recording && (
            <span
              className="absolute inset-0 rounded-full bg-red-500/40"
              style={{
                transform: `scale(${1 + rec.level * 0.6})`,
                transition: "transform 80ms",
              }}
            />
          )}
          <span className="relative">
            {recording ? (
              <Square className="size-12 fill-current" aria-hidden />
            ) : (
              <Mic className="size-16" aria-hidden />
            )}
          </span>
        </button>
        <VoiceVisualizer
          bars={rec.bars}
          active={recording}
          elapsed={rec.elapsed}
          max={MAX_RECORD_SECONDS}
        />
        <p className="text-xl font-bold">
          {recording ? "বলছেন... শেষ হলে আবার চাপ দিন" : "চাপ দিয়ে বলা শুরু করুন"}
        </p>
        {recording && rec.elapsed >= MAX_RECORD_SECONDS - RECORD_WARN_SECONDS && (
          <p role="status" className="rounded-full bg-amber-100 px-4 py-1.5 font-semibold text-amber-900">
            আর {toBn(Math.max(0, MAX_RECORD_SECONDS - rec.elapsed))} সেকেন্ড বাকি, শেষ কথাটা বলে নিন
          </p>
        )}
      </div>

      {(error ?? rec.error) && (
        <p className="rounded-xl bg-red-50 p-3 text-red-700">
          {error ?? rec.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-outline" onClick={() => setShowType((v) => !v)}>
          <Keyboard className="size-5" aria-hidden /> লিখে জানান
        </button>
        <button className="btn-outline" onClick={openForm}>
          <ListChecks className="size-5" aria-hidden /> চাপ দিয়ে জানান
        </button>
      </div>

      {showType && (
        <div className="card fade-up flex flex-col gap-3">
          <textarea
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            rows={3}
            maxLength={2000}
            className="input"
            placeholder="যেমন: জ্বর কমেছে কিন্তু পেটে ব্যথা, দুইবার বমি"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setTyped(ex)}
                className="min-h-11 rounded-full bg-slate-100 px-3 py-1 text-left text-sm transition-colors hover:bg-slate-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            disabled={typed.trim().length < 3 || text.isPending}
            onClick={() => {
              setError(null);
              setStep("processing");
              text.mutate({ transcript: typed.trim() });
            }}
          >
            পাঠান
          </button>
        </div>
      )}

      <Link
        href={`/p/${patientId}`}
        className="text-center text-slate-500 underline"
      >
        বাতিল
      </Link>
    </div>
  );
}
