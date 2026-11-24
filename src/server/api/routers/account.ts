import { z } from "zod";
import { areaName } from "~/lib/areas";
import { dayOfFever } from "~/lib/risk/who-rules";
import { getUser, isStaff } from "~/server/auth";
import { createTRPCRouter, publicProcedure, userProcedure } from "~/server/api/trpc";

/** Optional family login: keep "my patients" across phones. Patient pages never require it. */
export const accountRouter = createTRPCRouter({
  /** Who is signed in (null if nobody). Public so the UI can decide what to show. */
  me: publicProcedure.query(async () => {
    const user = await getUser();
    return user ? { ...user, staff: isStaff(user.email) } : null;
  }),

  /** Link patients opened on this phone to the signed-in account (ignores unknown IDs). */
  claim: userProcedure
    .input(z.object({ patientIds: z.array(z.string().min(1).max(40)).max(20) }))
    .mutation(async ({ ctx, input }) => {
      if (input.patientIds.length === 0) return { linked: 0 };
      const existing = await ctx.db.patient.findMany({
        where: { id: { in: input.patientIds } },
        select: { id: true },
      });
      const res = await ctx.db.patientAccess.createMany({
        data: existing.map((p) => ({ email: ctx.user.email, patientId: p.id })),
        skipDuplicates: true,
      });
      return { linked: res.count };
    }),

  /** Patients saved to this account, newest activity first. */
  myPatients: userProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.patientAccess.findMany({
      where: { email: ctx.user.email },
      include: {
        patient: {
          select: {
            id: true,
            nickname: true,
            ageYears: true,
            area: true,
            feverStart: true,
            assessments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
          },
        },
      },
    });
    const now = new Date();
    return rows
      .map(({ patient: p }) => ({
        id: p.id,
        nickname: p.nickname,
        ageYears: p.ageYears,
        areaBn: areaName(p.area),
        dayOfFever: dayOfFever(p.feverStart, now),
        status: p.assessments[0]?.status ?? null,
        lastAt: p.assessments[0]?.createdAt ?? p.feverStart,
      }))
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  }),

  /** Remove a patient from this account (the patient record itself is kept). */
  forget: userProcedure
    .input(z.object({ patientId: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.patientAccess.deleteMany({ where: { email: ctx.user.email, patientId: input.patientId } }),
    ),
});
