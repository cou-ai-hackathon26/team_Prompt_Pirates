import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { flagMissedDangerSigns } from "~/lib/ai/safety-net";
import { mentionedSchema, symptomsSchema, type VoiceExtraction } from "~/lib/ai/schemas";
import { voiceConflicts } from "~/lib/risk/consistency";
import { dayOfFever } from "~/lib/risk/who-rules";
import {
  identityAnswer,
  recordConflicts,
  standaloneStatus,
} from "~/server/services/conflicts";
import { extractFromTranscript, extractVoice } from "~/lib/ai/service";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reassessPatient } from "~/server/services/assess";

/**
 * The app sends 16 kHz 32 kbps MP3: 2 min is ~480 KB, ~640 KB as base64. The cap also allows the
 * WAV fallback (~60 s) while staying under Vercel's 4.5 MB request body limit.
 */
const MAX_AUDIO_BASE64 = 4_000_000;

/** Highlight danger signs the words mention but the AI left empty (never sets values). */
const withSafetyNet = <T extends { value: VoiceExtraction }>(r: T): T => ({
  ...r,
  value: {
    ...r.value,
    unclearFields: flagMissedDangerSigns(
      r.value.transcriptBn,
      r.value.symptoms,
      r.value.unclearFields,
    ),
  },
});

const aiError = (err: unknown) =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "AI এখন সাড়া দিচ্ছে না। নিচের ফর্ম দিয়ে উপসর্গ দিন।",
    cause: err,
  });

export const checkinRouter = createTRPCRouter({
  /** Step 1a: voice clip -> extracted symptoms (not saved yet; the user confirms first). */
  extractVoice: publicProcedure
    .input(
      z.object({
        audioBase64: z.string().max(MAX_AUDIO_BASE64),
        mimeType: z
          .enum(["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/mp4", "audio/ogg"])
          .default("audio/wav"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return withSafetyNet(
          await extractVoice(input.audioBase64, input.mimeType),
        );
      } catch (err) {
        throw aiError(err);
      }
    }),

  /** Step 1b: text from browser speech recognition (or typed) -> extracted symptoms. */
  extractText: publicProcedure
    .input(z.object({ transcript: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      try {
        return withSafetyNet(await extractFromTranscript(input.transcript));
      } catch (err) {
        throw aiError(err);
      }
    }),

  /**
   * Step 2: save confirmed symptoms and re-run the risk engine.
   * If the message seems to be about someone else (age / sex / name / two people), nothing is saved:
   * the result is "held" and the family is asked. "other" -> not saved, but told if THAT person is in danger.
   */
  save: publicProcedure
    .input(
      z.object({
        patientId: z.string(),
        source: z.enum(["VOICE", "FORM"]),
        transcript: z.string().optional(),
        symptoms: symptomsSchema,
        mentioned: mentionedSchema.optional(),
        identityAnswer: z.enum(identityAnswer).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { mentioned, identityAnswer: answer, ...checkIn } = input;
      const patient = await ctx.db.patient.findUniqueOrThrow({ where: { id: input.patientId } });
      const now = new Date();
      const conflicts = mentioned
        ? voiceConflicts(patient, mentioned, dayOfFever(patient.feverStart, now))
        : [];
      const identity = conflicts.filter((c) => c.kind === "identity");
      const otherFeverStart =
        mentioned?.feverDay != null
          ? new Date(now.getTime() - (mentioned.feverDay - 1) * 864e5)
          : patient.feverStart;
      const dangerIfOther = () =>
        standaloneStatus({
          symptoms: input.symptoms,
          ageYears: mentioned?.ageYears ?? patient.ageYears,
          feverStart: otherFeverStart,
        });

      if (identity.length > 0 && !answer)
        return { outcome: "held" as const, conflicts: identity, dangerIfOther: dangerIfOther() };
      if (identity.length > 0 && answer === "other") {
        await recordConflicts(input.patientId, "VOICE", identity, "REJECTED_OTHER");
        return { outcome: "rejected" as const, dangerIfOther: dangerIfOther() };
      }

      await ctx.db.checkIn.create({ data: checkIn });
      await recordConflicts(input.patientId, "VOICE", identity, "CONFIRMED_SAME");
      await recordConflicts(
        input.patientId,
        "VOICE",
        conflicts.filter((c) => c.kind !== "identity"),
        "NOTED",
      );
      return { outcome: "saved" as const, assessment: await reassessPatient(input.patientId) };
    }),
});
