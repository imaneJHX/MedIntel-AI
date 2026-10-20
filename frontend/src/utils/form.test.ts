import { describe, expect, it } from "vitest";
import fixture from "../test/fixtures/schema.json";
import { inputSchema } from "../types/api";
import {
  buildFormSchema,
  demoDraft,
  emptyDraft,
  NULL_VALUE,
  toPayload,
} from "./form";
const schema = inputSchema.parse(fixture);
describe("schema-based input validation", () => {
  it("creates exactly 13 numeric/null keys and preserves categorical zero", () => {
    const payload = toPayload(demoDraft, schema);
    expect(Object.keys(payload)).toHaveLength(13);
    expect(payload).toMatchObject({ fbs: 0, age: 55, oldpeak: 1 });
  });
  it("rejects blanks rather than coercing them to zero", () => {
    expect(buildFormSchema(schema).safeParse(emptyDraft()).success).toBe(false);
    expect(() => toPayload({ ...demoDraft, age: "" }, schema)).toThrow();
  });
  it("converts explicit unknown into null without changing zero", () => {
    expect(toPayload({ ...demoDraft, age: NULL_VALUE }, schema)).toMatchObject({
      age: null,
      fbs: 0,
    });
  });
  it.each([
    { age: "28" },
    { age: "78" },
    { age: "Infinity" },
    { cp: "99" },
    { cp: "1.5" },
    { oldpeak: "-1" },
  ])("rejects unsupported inputs %j", (change) => {
    expect(
      buildFormSchema(schema).safeParse({ ...demoDraft, ...change }).success,
    ).toBe(false);
  });
  it("rejects an entirely unknown record", () => {
    const draft = Object.fromEntries(
      Object.keys(demoDraft).map((name) => [name, NULL_VALUE]),
    );
    expect(buildFormSchema(schema).safeParse(draft).success).toBe(false);
  });
  it("reads numeric bounds from the supplied schema, not hardcoded limits", () => {
    const narrower = {
      ...schema,
      fields: schema.fields.map((field) =>
        field.name === "age" ? { ...field, maximum: 50 } : field,
      ),
    };
    expect(buildFormSchema(narrower).safeParse(demoDraft).success).toBe(false);
  });
});
