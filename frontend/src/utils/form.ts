import { z } from "zod";
import {
  featureNames,
  type Draft,
  type HeartRecord,
  type InputSchema,
} from "../types/api";

export const NULL_VALUE = "__null__";
export const emptyDraft = (): Draft =>
  Object.fromEntries(featureNames.map((name) => [name, ""])) as Draft;
// Fabricated example from the backend OpenAPI HeartRecord example; not a patient.
export const demoDraft: Draft = {
  age: "55",
  sex: "1",
  cp: "4",
  trestbps: "140",
  chol: "240",
  fbs: "0",
  restecg: "0",
  thalach: "150",
  exang: "0",
  oldpeak: "1",
  slope: "2",
  ca: "0",
  thal: "3",
};

/** Keep blank, numeric zero, and explicitly unknown values distinct. */
export function buildFormSchema(schema: InputSchema) {
  const shape = Object.fromEntries(
    schema.fields.map((field) => [
      field.name,
      z.string().superRefine((raw, ctx) => {
        const fail = (message: string) =>
          ctx.addIssue({ code: "custom", message });
        if (raw === NULL_VALUE) {
          if (!field.nullable) fail("A value is required.");
          return;
        }
        if (raw.trim() === "") {
          fail("Enter a value or explicitly mark it unknown.");
          return;
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          fail("Enter a finite number.");
          return;
        }
        if (field.type === "integer" && !Number.isInteger(value))
          fail("Choose a documented category.");
        if (
          field.options.length &&
          !field.options.some((option) => option.value === value)
        )
          fail("Choose a documented category.");
        if (field.minimum !== null && value < field.minimum)
          fail(`Supported minimum: ${field.minimum}.`);
        if (field.maximum !== null && value > field.maximum)
          fail(`Supported maximum: ${field.maximum}.`);
      }),
    ]),
  ) as Record<keyof Draft, z.ZodString>;
  return z.object(shape).superRefine((draft, ctx) => {
    if (Object.values(draft).every((value) => value === NULL_VALUE))
      ctx.addIssue({
        code: "custom",
        path: ["age"],
        message: "At least one input must be known.",
      });
  });
}
export function toPayload(draft: Draft, schema: InputSchema): HeartRecord {
  const validated = buildFormSchema(schema).parse(draft);
  return Object.fromEntries(
    featureNames.map((name) => [
      name,
      validated[name] === NULL_VALUE ? null : Number(validated[name]),
    ]),
  ) as HeartRecord;
}
