import type {
  ReportExplanation,
  ReportExplanationRequest,
} from "../types/reportExplanations";
import { compareReview } from "./reportReview";
import type { Interval } from "../types/reports";

const sameInterval = (left: Interval | null, right: Interval | null) =>
  left === null || right === null
    ? left === right
    : (
        [
          "lower",
          "upper",
          "lower_inclusive",
          "upper_inclusive",
          "unit",
          "raw_text",
        ] as const
      ).every((key) => left[key] === right[key]);

/** Reject a schema-valid response if its facts do not match the submitted snapshot. */
export function matchesReviewedFacts(
  result: ReportExplanation,
  request: ReportExplanationRequest,
): boolean {
  if (
    result.language !== request.language ||
    result.measurement_explanations.length !== request.measurements.length ||
    result.counts.reviewed !== request.measurements.length
  )
    return false;
  const counts = {
    below_reported_interval: 0,
    within_reported_interval: 0,
    above_reported_interval: 0,
    not_evaluated: 0,
  };
  for (const [index, source] of request.measurements.entries()) {
    const row = result.measurement_explanations[index];
    if (
      row.measurement_id !== source.id ||
      row.source_name !== source.name ||
      row.value !== source.value ||
      row.unit !== source.unit ||
      row.user_corrected !== source.user_corrected ||
      !sameInterval(row.reference_range, source.reference_range) ||
      row.source_measurement_ids.length !== 1 ||
      row.source_measurement_ids[0] !== source.id ||
      row.comparison !==
        compareReview(source.value, source.unit, source.reference_range)
    )
      return false;
    counts[row.comparison]++;
  }
  return (
    Object.entries(counts).every(
      ([key, value]) => result.counts[key as keyof typeof counts] === value,
    ) &&
    result.questions_for_doctor.length === request.measurements.length &&
    result.questions_for_doctor.every(
      (question, index) =>
        question.source_measurement_ids.length === 1 &&
        question.source_measurement_ids[0] === request.measurements[index].id,
    )
  );
}
