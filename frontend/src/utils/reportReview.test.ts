import { expect, it } from "vitest";
import { compareReview, validateReview } from "./reportReview";
import type { Interval } from "../types/reports";
const range: Interval = {
  lower: 12,
  upper: 16,
  lower_inclusive: true,
  upper_inclusive: true,
  unit: "g/dL",
  raw_text: "12 - 16",
};
it.each([
  [11.2, "below_reported_interval"],
  [12, "within_reported_interval"],
  [16, "within_reported_interval"],
  [17, "above_reported_interval"],
] as const)("compares %s against document bounds", (value, expected) => {
  expect(compareReview(value, "g/dL", range)).toBe(expected);
});
it("does not infer reference intervals or convert units", () => {
  expect(compareReview(11.2, "g/dL", null)).toBe("not_evaluated");
  expect(compareReview(112, "g/L", range)).toBe("not_evaluated");
  expect(compareReview(null, "g/dL", range)).toBe("not_evaluated");
});
it("handles explicit exclusive and one-sided bounds", () => {
  expect(
    compareReview(12, "g/dL", {
      ...range,
      lower_inclusive: false,
      upper: null,
    }),
  ).toBe("below_reported_interval");
  expect(
    compareReview(16, "g/dL", {
      ...range,
      lower: null,
      upper_inclusive: false,
    }),
  ).toBe("above_reported_interval");
});
it("rejects invalid manual corrections without converting a blank to zero", () => {
  const draft = {
    name: "Hemoglobin",
    value: "",
    unit: "",
    lower: "",
    upper: "",
    referenceUnit: "",
    lowerInclusive: true,
    upperInclusive: true,
  };
  expect(validateReview(draft)).toBeNull();
  expect(validateReview({ ...draft, value: "1,234" })).not.toBeNull();
  expect(validateReview({ ...draft, value: "Infinity" })).not.toBeNull();
});
