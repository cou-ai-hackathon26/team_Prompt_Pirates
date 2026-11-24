import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { HospitalFinder } from "./hospital-finder";

export default async function HospitalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    select: { nickname: true, area: true, assessments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
  });
  if (!patient) notFound();
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold">নিকটস্থ হাসপাতাল</h1>
      <HospitalFinder patientId={id} area={patient.area} status={patient.assessments[0]?.status ?? "GREEN"} />
    </main>
  );
}
