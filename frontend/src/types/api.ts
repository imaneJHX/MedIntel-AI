import { z } from "zod";

// These runtime contracts mirror app/schemas/*.py and the live /openapi.json.
export const featureNames = [
  "age",
  "sex",
  "cp",
  "trestbps",
  "chol",
  "fbs",
  "restecg",
  "thalach",
  "exang",
  "oldpeak",
  "slope",
  "ca",
  "thal",
] as const;
export const featureNameSchema = z.enum(featureNames);
export type FeatureName = (typeof featureNames)[number];
export type HeartRecord = Record<FeatureName, number | null>;
export type Draft = Record<FeatureName, string>;

const finite = z.number().finite();
export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("MedIntel AI"),
  version: z.literal("1.0.0"),
});
export const readySchema = z.object({
  status: z.literal("ready"),
  model_loaded: z.literal(true),
  explainer_initialized: z.literal(true),
});
export const fieldSchema = z.object({
  name: featureNameSchema,
  label: z.string(),
  type: z.enum(["number", "integer"]),
  unit: z.string().nullable(),
  description: z.string(),
  required: z.boolean(),
  nullable: z.boolean(),
  minimum: finite.nullable(),
  maximum: finite.nullable(),
  options: z.array(z.object({ value: z.number().int(), label: z.string() })),
});
export const inputSchema = z.object({
  model: z.literal("heart-disease-logistic-regression"),
  fields: z
    .array(fieldSchema)
    .length(13)
    .refine(
      (fields) => new Set(fields.map((f) => f.name)).size === 13,
      "Expected all 13 unique features",
    ),
  numeric_range_semantics: z.string(),
  missing_value_policy: z.string(),
});
export const metadataSchema = z.object({
  model: z.string(),
  algorithm: z.string(),
  dataset: z.string(),
  dataset_url: z.url(),
  input_features: z.array(featureNameSchema).length(13),
  transformed_feature_count: z.number().int(),
  class_labels: z.record(z.string(), z.string()),
  artifact_sha256: z.string(),
  threshold: finite,
  research_only: z.literal(true),
  evaluation_records: z.number().int(),
  experimental_holdout_metrics: z.record(z.string(), finite),
  limitations: z.array(z.string()),
  disclaimer: z.string(),
});
export const predictionSchema = z.object({
  model: z.literal("heart-disease-logistic-regression"),
  prediction: z.object({
    class_id: z.union([z.literal(0), z.literal(1)]),
    class_label: z.string(),
    positive_class_score: finite.min(0).max(1),
    threshold: finite.gt(0).lt(1),
    score_semantics: z.literal("uncalibrated_experimental_model_score"),
  }),
  disclaimer: z.string(),
});
export const contributionSchema = z.object({
  feature: z.string(),
  original_feature: featureNameSchema,
  category: finite.nullable(),
  transformed_value: finite,
  contribution_log_odds: finite,
});
export const explanationSchema = predictionSchema.extend({
  explanation: z.object({
    units: z.literal("positive-class log-odds"),
    baseline_log_odds: finite,
    model_output_log_odds: finite,
    reconstructed_log_odds: finite,
    max_reconstruction_error: finite,
    background_records: z.number().int(),
    input_values: z.record(featureNameSchema, finite.nullable()),
    feature_contributions: z.array(contributionSchema).length(28),
    top_positive_contributors: z.array(contributionSchema),
    top_negative_contributors: z.array(contributionSchema),
    interpretation: z.string(),
  }),
});
export type InputField = z.infer<typeof fieldSchema>;
export type InputSchema = z.infer<typeof inputSchema>;
export type ModelMetadata = z.infer<typeof metadataSchema>;
export type PredictionResponse = z.infer<typeof predictionSchema>;
export type ExplanationResponse = z.infer<typeof explanationSchema>;
export type Contribution = z.infer<typeof contributionSchema>;
