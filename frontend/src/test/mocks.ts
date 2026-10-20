import { vi } from "vitest";
import health from "./fixtures/health.json";
import ready from "./fixtures/ready.json";
import metadata from "./fixtures/metadata.json";
import schema from "./fixtures/schema.json";
import prediction from "./fixtures/prediction.json";
import explanation from "./fixtures/explanation.json";
export { health, ready, metadata, schema, prediction, explanation };
export function mockApi() {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const bodies: Record<string, unknown> = {
      "/api/v1/health": health,
      "/api/v1/ready": ready,
      "/api/v1/models/heart-disease": metadata,
      "/api/v1/models/heart-disease/schema": schema,
      "/api/v1/predict/heart-disease": prediction,
      "/api/v1/explain/heart-disease": explanation,
    };
    return new Response(JSON.stringify(bodies[path]), {
      status: bodies[path] ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
