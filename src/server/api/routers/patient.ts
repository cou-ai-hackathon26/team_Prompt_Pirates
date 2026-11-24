import { z } from "zod";
import { isValidArea, resolveAreaId } from "~/lib/areas";
import { getUser } from "~/server/auth";
import { startOfDhakaDay } from "~/lib/fluids";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reassessPatient } from "~/server/services/assess";

export const patientRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        nickname: z.string().min(1).max(60),
        ageYears: z.number().int().min(0).max(120),
        sex: z.enum(["male", "female", "other"]).optional(),
        weightKg: z.number().min(1).max(250).optional(),
        riskFactors: z.array(z.string()).default([]),
        area: z
          .string()
          .min(1)
          .refine(isValidArea, "Unknown area")
          .transform(resolveAreaId),
        // Up to 14 days ago (+1 day slack for time zones), never in the future.
        feverStart: z.coerce
          .date()
          .refine((d) => d.getTime() <= Date.now() + 3600e3, "Fever start is in the future")
          .refine((d) => d.getTime() >= Date.now() - 15 * 864e5, "Fever start is more than 14 days ago"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.create({ data: input });
      // Optional family login: a signed-in creator gets the patient in "আমার রোগী" automatically.
      const user = await getUser();
      if (user)
        await ctx.db.patientAccess.create({ data: { email: user.email, patientId: patient.id } });
      await reassessPatient(patient.id, { useAi: false });
      return patient;
    }),

  /** Everything the patient home screen needs. */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.patient.findUnique({
        where: { id: input.id },
        include: {
          checkIns: { orderBy: { createdAt: "desc" }, take: 14 },
          labs: { where: { confirmed: true }, orderBy: { takenAt: "asc" } },
          assessments: { orderBy: { createdAt: "desc" }, take: 30 },
          fluids: {
            where: { createdAt: { gte: startOfDhakaDay() } },
            select: { ml: true },
          },
        },
      }),
    ),

  reassess: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => reassessPatient(input.id)),
});
