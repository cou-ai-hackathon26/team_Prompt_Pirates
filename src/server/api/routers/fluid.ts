import { z } from "zod";
import { fluidTargetMl, startOfDhakaDay } from "~/lib/fluids";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const fluidRouter = createTRPCRouter({
  /** Today's total (Dhaka day), target, and the logged entries. */
  today: publicProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findUnique({
        where: { id: input.patientId },
        select: { ageYears: true, weightKg: true },
      });
      if (!patient) return null;
      const since = startOfDhakaDay();
      const logs = await ctx.db.fluidLog.findMany({
        where: { patientId: input.patientId, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { id: true, ml: true, kind: true, createdAt: true },
      });
      const target = fluidTargetMl(patient.ageYears, patient.weightKg);
      return {
        totalMl: logs.reduce((s, l) => s + l.ml, 0),
        targetMl: target.ml,
        estimatedWeight: target.estimatedWeight,
        logs,
      };
    }),

  add: publicProcedure
    .input(
      z.object({
        patientId: z.string(),
        // a glass is ~200 ml, an ORS packet makes 500 ml; cap a single entry at 1 L
        ml: z.number().int().min(25).max(1000),
        kind: z.enum(["water", "ors", "other"]).default("water"),
      }),
    )
    .mutation(({ ctx, input }) => ctx.db.fluidLog.create({ data: input })),

  /** Remove the most recent entry from today (for mis-taps). */
  undo: publicProcedure
    .input(z.object({ patientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const last = await ctx.db.fluidLog.findFirst({
        where: {
          patientId: input.patientId,
          createdAt: { gte: startOfDhakaDay() },
        },
        orderBy: { createdAt: "desc" },
      });
      if (last) await ctx.db.fluidLog.delete({ where: { id: last.id } });
      return { removed: last?.ml ?? 0 };
    }),
});
