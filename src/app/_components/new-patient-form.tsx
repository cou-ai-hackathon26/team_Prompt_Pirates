"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AreaPicker, LAST_AREA_KEY } from "./area-picker";
import { getArea } from "~/lib/areas";
import { rememberPatient } from "~/lib/local-patients";
import { api } from "~/trpc/react";
import { friendlyError } from "~/lib/friendly-error";
import { Check } from "lucide-react";

export { STORAGE_KEY } from "~/lib/local-patients";

const RISK_OPTIONS = [
  { id: "pregnant", label: "গর্ভবতী" },
  { id: "diabetes", label: "ডায়াবেটিস" },
  { id: "kidney", label: "কিডনি রোগ" },
  { id: "heart", label: "হৃদরোগ" },
  { id: "obesity", label: "অতিরিক্ত ওজন" },
];

export function NewPatientForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [weight, setWeight] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [feverDaysAgo, setFeverDaysAgo] = useState("0");
  const [risks, setRisks] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  // A family adding a second patient usually lives in the same area.
  useEffect(() => {
    const last = localStorage.getItem(LAST_AREA_KEY);
    if (last && getArea(last)) setArea(last);
  }, []);

  const create = api.patient.create.useMutation({
    onSuccess: (p) => {
      rememberPatient(p.id);
      localStorage.setItem(LAST_AREA_KEY, p.area);
      router.push(`/p/${p.id}`);
    },
  });

  const ageNum = Number(age);
  const errors = {
    nickname: nickname.trim().length === 0 ? "নাম লিখুন" : null,
    age:
      age === "" || !Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120
        ? "০ থেকে ১২০ এর মধ্যে বয়স লিখুন"
        : null,
    weight:
      weight !== "" && (Number(weight) < 1 || Number(weight) > 250)
        ? "সঠিক ওজন লিখুন (কেজি)"
        : null,
    area: area ? null : "এলাকা বেছে নিন",
  };
  const valid = !errors.nickname && !errors.age && !errors.weight && !errors.area;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || !area) return;
    // Fever started N days ago -> today is fever day N+1
    const feverStart = new Date(
      Date.now() - (Number(feverDaysAgo) * 24 + 2) * 3600e3,
    );
    create.mutate({
      nickname: nickname.trim(),
      ageYears: ageNum,
      sex: sex || undefined,
      weightKg: weight ? Number(weight) : undefined,
      area,
      feverStart,
      riskFactors: risks,
    });
  };

  const err = (m: string | null) =>
    touched && m && <span className="text-sm text-red-600">{m}</span>;

  return (
    <form onSubmit={submit} noValidate className="card flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">রোগীর নাম বা ডাকনাম</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={60}
          className="input"
          placeholder="যেমন: রহিম"
        />
        {err(errors.nickname)}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">বয়স (বছর)</span>
          <input
            type="number"
            min={0}
            max={120}
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="input"
          />
          {err(errors.age)}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">ওজন (কেজি, ঐচ্ছিক)</span>
          <input
            type="number"
            min={1}
            max={250}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="input"
          />
          {err(errors.weight)}
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-semibold">লিঙ্গ</legend>
        <div className="flex gap-2">
          {(
            [
              ["male", "ছেলে / পুরুষ"],
              ["female", "মেয়ে / নারী"],
            ] as const
          ).map(([v, l]) => (
            <button
              type="button"
              key={v}
              onClick={() => setSex(v)}
              className={`flex-1 rounded-xl border-2 py-2.5 font-semibold ${sex === v ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <AreaPicker
        value={area}
        onChange={setArea}
        error={touched ? errors.area : null}
      />

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">জ্বর কবে শুরু হয়েছে?</span>
        <select
          value={feverDaysAgo}
          onChange={(e) => setFeverDaysAgo(e.target.value)}
          className="input"
        >
          <option value="0">আজ</option>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {d.toLocaleString("bn-BD")} দিন আগে (আজ জ্বরের{" "}
              {(d + 1).toLocaleString("bn-BD")} নম্বর দিন)
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-2 font-semibold">অন্য কোনো সমস্যা আছে?</legend>
        <div className="flex flex-wrap gap-2">
          {RISK_OPTIONS.map((r) => {
            const on = risks.includes(r.id);
            return (
              <button
                type="button"
                key={r.id}
                aria-pressed={on}
                onClick={() =>
                  setRisks((cur) =>
                    on ? cur.filter((x) => x !== r.id) : [...cur, r.id],
                  )
                }
                className={`inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-4 py-1.5 font-medium transition-colors ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300"}`}
              >
                {on && <Check className="size-4" aria-hidden />}
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          ১ বছরের কম বা ৬৫ বছরের বেশি বয়স হলে অ্যাপ নিজেই বেশি সতর্ক থাকবে।
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={create.isPending}
        className="btn-primary w-full"
      >
        {create.isPending ? "অপেক্ষা করুন..." : "শুরু করুন →"}
      </button>
      {create.error && (
        <p className="rounded-xl bg-red-50 p-3 text-red-700">
          {friendlyError(create.error)}
        </p>
      )}
    </form>
  );
}
