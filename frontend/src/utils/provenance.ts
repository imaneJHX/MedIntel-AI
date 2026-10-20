// Verified against reports/metrics/experiment.json and src/preprocessing.py.
// Historical research metadata, never application usage or newly computed metrics.
export const study = {
  records: 303,
  train: 242,
  test: 61,
  seed: 42,
  folds: 5,
  source: "Phase 3 experiment.json · src/preprocessing.py",
} as const;
export const formatMetric = (value: number | undefined) =>
  value === undefined ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
export const metricLabels: Record<string, string> = {
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  f1: "F1 score",
  roc_auc: "ROC-AUC",
  specificity: "Specificity",
  brier_score: "Brier score",
};
