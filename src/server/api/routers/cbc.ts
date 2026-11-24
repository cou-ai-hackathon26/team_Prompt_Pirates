import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { extractCbc } from "~/lib/ai/service";
import { normalizeCbc } from "~/lib/risk/cbc-normalize";
import { identityConflicts, parseAgeYears, parseSex, reportConflicts } from "~/lib/risk/consistency";
import {
  identityAnswer,
  recordConflicts,
  standaloneStatus,
} from "~/server/services/conflicts";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reassessPatient } from "~/server/services/assess";

/** Client compresses to max 1600 px JPEG (~200-400 KB). 3 MB base64 is a hard cap. */
const MAX_IMAGE_BASE64 = 3_000_000;

export const cbcRouter = createTRPCRouter({
  /** Photo -> normalised values for the user to confirm. The photo itself is not stored. */
  extract: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().max(MAX_IMAGE_BASE64),
        mimeType: z.string().default("image/jpeg"),
      }),
    )
    .mutation(async ({ input }) => {
      let res;
      try {
        res = await extractCbc(input.imageBase64, input.mimeType);
      } catch (err) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "রিপোর্ট পড়া যায়নি। মানগুলো হাতে লিখে দিন।",
          cause: err,
        });
      }
      return { raw: res.value, provider: res.provider, values: normalizeCbc(res.value) };
    }),

  /**
   * Save user-confirmed values and re-run the risk engine.
   * A report printed for another person (name / age / sex) is HELD until the family answers;
   * "other" -> not saved for this patient, but they are told if that person needs hospital care.
   */
  save: publicProcedure
    .input(
      z.object({
        patientId: z.string(),
        takenAt: z.coerce.date(),
        plateletUl: z.number().int().min(1_000).max(1_500_000).nullable(),
        hctPct: z.number().min(10).max(70).nullable(),
        wbcUl: z.number().int().min(300).max(100_000).nullable(),
        hbGdl: z.number().min(3).max(22).nullable(),
        printed: z
          .object({
            name: z.string().max(120).nullable(),
            ageRaw: z.string().max(40).nullable(),
            sexRaw: z.string().max(20).nullable(),
          })
          .optional(),
        identityAnswer: z.enum(identityAnswer).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { printed, identityAnswer: answer, ...lab } = input;
      const patient = await ctx.db.patient.findUniqueOrThrow({
        where: { id: input.patientId },
        include: { labs: { where: { confirmed: true } } },
      });
      const claimedAge = parseAgeYears(printed?.ageRaw);
      const identity = printed
        ? identityConflicts(
            patient,
            { name: printed.name, ageYears: claimedAge, sex: parseSex(printed.sexRaw) },
            "report",
          )
        : [];
      const other = reportConflicts({
        lab,
        previous: patient.labs,
        feverStart: patient.feverStart,
        now: new Date(),
      });
      const dangerIfOther = () =>
        standaloneStatus({ lab, ageYears: claimedAge ?? patient.ageYears, feverStart: patient.feverStart });

      if (identity.length > 0 && !answer)
        return { outcome: "held" as const, conflicts: identity, dangerIfOther: dangerIfOther() };
      if (identity.length > 0 && answer === "other") {
        await recordConflicts(input.patientId, "CBC", identity, "REJECTED_OTHER");
        return { outcome: "rejected" as const, dangerIfOther: dangerIfOther() };
      }

      await ctx.db.labResult.create({ data: { ...lab, confirmed: true } });
      await recordConflicts(input.patientId, "CBC", identity, "CONFIRMED_SAME");
      await recordConflicts(input.patientId, "CBC", other, "NOTED");
      return { outcome: "saved" as const, assessment: await reassessPatient(input.patientId) };
    }),
});
