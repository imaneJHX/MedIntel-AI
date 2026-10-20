import type { Comparison, Interval, Measurement } from "../types/reports";
export type ReviewDraft = {
  name: string;
  value: string;
  unit: string;
  lower: string;
  upper: string;
  referenceUnit: string;
  lowerInclusive: boolean;
  upperInclusive: boolean;
};
export const toReviewDraft = (row: Measurement): ReviewDraft => ({
  name: row.name,
  value: row.value === null ? "" : String(row.value),
  unit: row.unit ?? "",
  lower:
    row.reference_range?.lower === null ||
    row.reference_range?.lower === undefined
      ? ""
      : String(row.reference_range.lower),
  upper:
    row.reference_range?.upper === null ||
    row.reference_range?.upper === undefined
      ? ""
      : String(row.reference_range.upper),
  referenceUnit: row.reference_range?.unit ?? "",
  lowerInclusive: row.reference_range?.lower_inclusive ?? true,
  upperInclusive: row.reference_range?.upper_inclusive ?? true,
});
const unitKey = (raw: string) => raw.trim().toLowerCase().replace(/[µμ]/g, "u");
const units = new Set([
  "g/dl",
  "g/l",
  "mg/dl",
  "mmol/l",
  "umol/l",
  "10^9/l",
  "10^3/ul",
  "10^6/ul",
  "cells/ul",
]);
export function compareReview(
  value: number | null,
  unit: string | null,
  range: Interval | null,
): Comparison {
  if (
    value === null ||
    !unit ||
    !range?.unit ||
    !units.has(unitKey(unit)) ||
    unitKey(unit) !== unitKey(range.unit)
  )
    return "not_evaluated";
  if (
    (range.lower === null && range.upper === null) ||
    (range.lower !== null && range.upper !== null && range.lower > range.upper)
  )
    return "not_evaluated";
  if (
    range.lower !== null &&
    (value < range.lower || (value === range.lower && !range.lower_inclusive))
  )
    return "below_reported_interval";
  if (
    range.upper !== null &&
    (value > range.upper || (value === range.upper && !range.upper_inclusive))
  )
    return "above_reported_interval";
  return "within_reported_interval";
}
export function validateReview(draft: ReviewDraft): string | null {
  if (!draft.name.trim() || draft.name.length > 80)
    return "Enter a measurement name of 1–80 characters.";
  for (const [label, text] of [
    ["Result", draft.value],
    ["Lower bound", draft.lower],
    ["Upper bound", draft.upper],
  ]) {
    if (
      text.trim() &&
      (!/^\d+(?:\.\d+)?$/.test(text) ||
        !Number.isFinite(Number(text)) ||
        Number(text) > 1e9)
    )
      return `${label} must be a finite non-negative number with a decimal point; leave it blank if uncertain.`;
  }
  if (draft.unit.length > 40 || draft.referenceUnit.length > 40)
    return "Units must contain at most 40 characters.";
  if (
    draft.lower.trim() &&
    draft.upper.trim() &&
    Number(draft.lower) > Number(draft.upper)
  )
    return "The lower reference bound must not exceed the upper bound.";
  return null;
}
export function reviewValues(draft: ReviewDraft) {
  const value = draft.value.trim() ? Number(draft.value) : null;
  const unit = draft.unit.trim() || null;
  const range: Interval | null =
    draft.lower.trim() || draft.upper.trim()
      ? {
          lower: draft.lower.trim() ? Number(draft.lower) : null,
          upper: draft.upper.trim() ? Number(draft.upper) : null,
          unit: draft.referenceUnit.trim() || null,
          lower_inclusive: draft.lowerInclusive,
          upper_inclusive: draft.upperInclusive,
          raw_text: "User-reviewed bounds",
        }
      : null;
  return {
    value,
    unit,
    range,
    comparison: validateReview(draft)
      ? ("not_evaluated" as const)
      : compareReview(value, unit, range),
  };
}
