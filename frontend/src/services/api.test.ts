import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { demoDraft, toPayload } from "../utils/form";
import {
  inputSchema,
  explanationSchema,
  predictionSchema,
  metadataSchema,
} from "../types/api";
import {
  mockApi,
  schema,
  prediction,
  explanation,
  metadata,
} from "../test/mocks";
import openapi from "../test/fixtures/openapi.json";
beforeEach(() => {
  mockApi();
});
describe("live-contract fixtures and client", () => {
  it("accepts actual backend prediction, explanation, metadata and form schema", () => {
    expect(predictionSchema.safeParse(prediction).success).toBe(true);
    expect(explanationSchema.safeParse(explanation).success).toBe(true);
    expect(metadataSchema.safeParse(metadata).success).toBe(true);
    expect(inputSchema.safeParse(schema).success).toBe(true);
  });
  it("matches required HeartRecord keys and all six routes from OpenAPI", () => {
    expect([...openapi.components.schemas.HeartRecord.required].sort()).toEqual(
      schema.fields.map((f) => f.name).sort(),
    );
    expect(Object.keys(openapi.paths)).toHaveLength(6);
    for (const name of ["model", "prediction", "disclaimer"])
      expect(
        openapi.components.schemas.PredictionResponse.required.concat(
          "model",
          "disclaimer",
        ),
      ).toContain(name);
  });
  it("rejects duplicate fields and unexpected explanation units", () => {
    expect(
      inputSchema.safeParse({
        ...schema,
        fields: Array(13).fill(schema.fields[0]),
      }).success,
    ).toBe(false);
    expect(
      explanationSchema.safeParse({
        ...explanation,
        explanation: { ...explanation.explanation, units: "probability" },
      }).success,
    ).toBe(false);
  });
  it("requests six typed endpoints and sends numeric JSON without credentials", async () => {
    const fetchMock = mockApi();
    const body = toPayload(demoDraft, inputSchema.parse(schema));
    await Promise.all([
      api.health(),
      api.ready(),
      api.metadata(),
      api.schema(),
      api.predict(body),
      api.explain(body),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).endsWith("/api/v1/explain/heart-disease"),
      ),
    ).toBe(true);
    const options = (
      fetchMock.mock.calls as unknown as [string, RequestInit][]
    ).find(([url]) => url.endsWith("/predict/heart-disease"))![1];
    expect(JSON.parse(String(options.body))).toEqual(body);
    expect(options.credentials).toBe("omit");
  });
  it.each([422, 503, 500])(
    "sanitizes HTTP %s errors without exposing raw data",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("SECRET_INPUT_AND_TRACE", { status }),
          ),
      );
      await expect(api.health()).rejects.toThrow(ApiError);
      try {
        await api.health();
      } catch (error) {
        expect(String(error)).not.toContain("SECRET");
      }
    },
  );
  it("handles network failures and invalid successful responses safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("SECRET")));
    await expect(api.health()).rejects.toMatchObject({ code: "network" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(api.health()).rejects.toMatchObject({ code: "response" });
  });
  it("handles unreadable JSON without exposing response contents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("PRIVATE_NOT_JSON")),
    );
    await expect(api.health()).rejects.toMatchObject({ code: "response" });
  });
  it("supports cancellation and request timeouts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const stop = () =>
              reject(new DOMException("Aborted", "AbortError"));
            if (init.signal?.aborted) stop();
            else init.signal?.addEventListener("abort", stop, { once: true });
          }),
      ),
    );
    const controller = new AbortController();
    const cancelled = expect(
      api.health(controller.signal),
    ).rejects.toMatchObject({ code: "cancelled" });
    controller.abort();
    await cancelled;
    const timedOut = expect(api.health()).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(20_001);
    await timedOut;
  });
});
