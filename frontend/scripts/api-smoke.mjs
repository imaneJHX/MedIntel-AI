import assert from "node:assert/strict";
const base = (process.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const origin = "http://127.0.0.1:3000";
const fabricated = {
  age: 55,
  sex: 1,
  cp: 4,
  trestbps: 140,
  chol: 240,
  fbs: 0,
  restecg: 0,
  thalach: 150,
  exang: 0,
  oldpeak: 1,
  slope: 2,
  ca: 0,
  thal: 3,
};
async function call(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `Unexpected status from ${path}`);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  return response.json();
}
try {
  const [health, ready, metadata, schema, contract] = await Promise.all(
    [
      "/api/v1/health",
      "/api/v1/ready",
      "/api/v1/models/heart-disease",
      "/api/v1/models/heart-disease/schema",
      "/openapi.json",
    ].map((path) => call(path)),
  );
  assert.equal(health.status, "ok");
  assert.equal(ready.status, "ready");
  assert.equal(metadata.algorithm, "Logistic Regression");
  assert.equal(schema.fields.length, 13);
  assert.deepEqual(
    [...contract.components.schemas.HeartRecord.required].sort(),
    Object.keys(fabricated).sort(),
  );
  const result = await call("/api/v1/predict/heart-disease", fabricated);
  const explained = await call("/api/v1/explain/heart-disease", fabricated);
  assert.equal(
    result.prediction.positive_class_score,
    explained.prediction.positive_class_score,
  );
  assert.equal(explained.explanation.units, "positive-class log-odds");
  assert.equal(explained.explanation.feature_contributions.length, 28);
  const reconstruction =
    explained.explanation.baseline_log_odds +
    explained.explanation.feature_contributions.reduce(
      (sum, row) => sum + row.contribution_log_odds,
      0,
    );
  assert.ok(
    Math.abs(reconstruction - explained.explanation.model_output_log_odds) <
      1e-10,
  );
  assert.ok(
    Math.abs(
      1 / (1 + Math.exp(-reconstruction)) -
        result.prediction.positive_class_score,
    ) < 1e-10,
  );
  const preflight = await fetch(`${base}/api/v1/predict/heart-disease`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    },
  });
  assert.equal(preflight.status, 200);
  console.log(
    JSON.stringify(
      {
        verified: true,
        six_endpoints: true,
        openapi: true,
        cors: true,
        prediction_class: result.prediction.class_id,
        positive_class_score: result.prediction.positive_class_score,
        shap_features: explained.explanation.feature_contributions.length,
        reconstruction_error: Math.abs(
          reconstruction - explained.explanation.model_output_log_odds,
        ),
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Integration smoke check failed. Verify the local backend, contracts, and configured API address. No input data has been printed.",
  );
  process.exitCode = 1;
}
