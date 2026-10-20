import { z } from "zod";
const finite = z.number().finite();
export const comparisonSchema = z.enum([
  "below_reported_interval",
  "within_reported_interval",
  "above_reported_interval",
  "not_evaluated",
]);
export const intervalSchema = z.object({
  lower: finite.nullable(),
  upper: finite.nullable(),
  lower_inclusive: z.boolean(),
  upper_inclusive: z.boolean(),
  unit: z.string().nullable(),
  raw_text: z.string(),
});
export const measurementSchema = z.object({
  id: z.string(),
  analyte: z.string(),
  name: z.string(),
  original_label: z.string(),
  value: finite.nullable(),
  unit: z.string().nullable(),
  reference_range: intervalSchema.nullable(),
  source_text: z.string(),
  extraction_confidence: z.null(),
  extraction_status: z.enum(["parsed", "ambiguous"]),
  status: comparisonSchema,
  review_required: z.literal(true),
  warnings: z.array(z.string()),
});
export const reportSchema = z.object({
  document_type: z.literal("synthetic_laboratory_report"),
  filename: z.string(),
  page_count: z.number().int().min(1).max(5),
  extraction_method: z.enum(["embedded_text", "local_ocr", "mixed"]),
  measurements: z.array(measurementSchema).max(50),
  education: z.array(
    z.object({
      analyte: z.string(),
      name: z.string(),
      explanation: z.string(),
      source_url: z.url(),
    }),
  ),
  warnings: z.array(z.string()),
  retained: z.literal(false),
  disclaimer: z.string(),
});
export type ReportExtraction = z.infer<typeof reportSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Interval = z.infer<typeof intervalSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export const comparisonLabels: Record<Comparison, string> = {
  below_reported_interval: "Below reported interval",
  within_reported_interval: "Within reported interval",
  above_reported_interval: "Above reported interval",
  not_evaluated: "Not evaluated",
};
