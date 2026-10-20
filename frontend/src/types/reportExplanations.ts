import { z } from "zod";
import { comparisonSchema, intervalSchema } from "./reports";
const quantity = z.number().finite().min(0).max(1e9);
const id = z.string().regex(/^measurement-[1-9][0-9]{0,2}$/);
export const languageSchema = z.enum(["en", "fr", "ar"]);
export type ReportLanguage = z.infer<typeof languageSchema>;
export type ReviewedMeasurement = {
  id: string;
  name: string;
  value: number | null;
  unit: string | null;
  reference_range: z.infer<typeof intervalSchema> | null;
  reviewed: true;
  user_corrected: boolean;
};
export type ReportExplanationRequest = {
  synthetic_only: true;
  language: ReportLanguage;
  measurements: ReviewedMeasurement[];
};
const count = z.number().int().min(0).max(50);
export const reportExplanationSchema = z
  .object({
    language: languageSchema,
    generation_method: z.literal("deterministic"),
    knowledge_version: z.literal("lab-education-1"),
    fallback_used: z.boolean(),
    counts: z
      .object({
        reviewed: count.min(1),
        below_reported_interval: count,
        within_reported_interval: count,
        above_reported_interval: count,
        not_evaluated: count,
      })
      .strict(),
    summary: z.string().min(1).max(1500),
    measurement_explanations: z
      .array(
        z
          .object({
            measurement_id: id,
            analyte: z.string().max(40),
            name: z.string().min(1).max(80),
            source_name: z.string().min(1).max(80),
            value: quantity.nullable(),
            unit: z.string().max(40).nullable(),
            reference_range: intervalSchema.nullable(),
            comparison: comparisonSchema,
            user_corrected: z.boolean(),
            definition: z.string().min(1).max(600),
            explanation: z.string().min(1).max(2000),
            source_measurement_ids: z.array(id).length(1),
            source_url: z
              .string()
              .url()
              .regex(/^https:\/\/medlineplus\.gov\/lab-tests\/[a-z-]+\/$/),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    questions_for_doctor: z
      .array(
        z
          .object({
            text: z.string().min(1).max(500),
            source_measurement_ids: z.array(id).length(1),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    warnings: z.array(z.string().max(600)).max(5),
    disclaimer: z.string().min(1).max(1000),
  })
  .strict();
export type ReportExplanation = z.infer<typeof reportExplanationSchema>;
