import { notFound } from "next/navigation";
import { dayOfFever } from "~/lib/risk/who-rules";
import { db } from "~/server/db";
import { CheckinFlow } from "./checkin-flow";

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, select: { nickname: true, feverStart: true } });
  if (!patient) notFound();
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold">{patient.nickname}: আজকের আপডেট</h1>
      <CheckinFlow patientId={id} patientName={patient.nickname} dayOfFever={dayOfFever(patient.feverStart, new Date())} />
    </main>
  );
}
