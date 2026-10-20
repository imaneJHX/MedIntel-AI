import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const read = (relative) => readFileSync(new URL(relative, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  const snapshot = JSON.parse(read("../src/data/researchComparison.json"));
  const csv = read("../../reports/metrics/cv_summary.csv");
  const manifest = read("../../reports/metrics/experiment.json");
  assert.equal(snapshot.source_sha256, hash(csv));
  assert.equal(snapshot.experiment_sha256, hash(manifest));
  assert.deepEqual(snapshot.models, JSON.parse(manifest).cv_summary);
  console.log(
    "All three model comparison rows match the frozen Phase 3 manifest; both source hashes match.",
  );
} catch {
  console.error(
    "Research snapshot verification failed. Check the local original Phase 3 reports and reviewed frontend snapshot. No reports were modified.",
  );
  process.exitCode = 1;
}
