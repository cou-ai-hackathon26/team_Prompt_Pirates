import { buildIcs, reminderEvents } from "~/lib/reminders";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

/** GET /p/<id>/reminders.ics: calendar file with daily check-in reminders through the critical phase. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    select: { nickname: true, feverStart: true },
  });
  if (!patient) return new Response("Not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const now = new Date();
  const events = reminderEvents({
    patientName: patient.nickname,
    feverStart: patient.feverStart,
    now,
    checkinUrl: `${origin}/p/${id}/checkin`,
  });
  const ics = buildIcs(events, {
    uidPrefix: id,
    now,
    url: `${origin}/p/${id}`,
  });

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="denguesathi-reminders.ics"`,
      "cache-control": "no-store",
    },
  });
}
