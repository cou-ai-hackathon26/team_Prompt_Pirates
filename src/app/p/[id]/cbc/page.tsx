import { notFound } from "next/navigation";
import samples from "../../../../../public/samples/cbc/index.json";
import { db } from "~/server/db";
import { CbcFlow } from "./cbc-flow";

export default async function CbcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, select: { nickname: true, feverStart: true } });
  if (!patient) notFound();
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold">{patient.nickname}: CBC রিপোর্ট</h1>
      <CbcFlow
        patientName={patient.nickname}
        patientId={id}
        feverStartIso={patient.feverStart.toISOString()}
        samples={samples.map((s) => ({ id: s.id, title: s.title }))}
      />
    </main>
  );
}
