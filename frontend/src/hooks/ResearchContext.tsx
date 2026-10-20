import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, safeError } from "../services/api";
import type {
  Draft,
  HeartRecord,
  InputSchema,
  ModelMetadata,
  PredictionResponse,
  ExplanationResponse,
} from "../types/api";
import { emptyDraft } from "../utils/form";

function useResearchState() {
  const [metadata, setMetadata] = useState<ModelMetadata>();
  const [schema, setSchema] = useState<InputSchema>();
  const [resourceError, setResourceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    "checking" | "ready" | "degraded" | "offline"
  >("checking");
  const [reload, setReload] = useState(0);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const draftRef = useRef(draft);
  const [snapshot, setSnapshot] = useState<Draft>();
  const [record, setRecord] = useState<HeartRecord>();
  const [prediction, setPrediction] = useState<PredictionResponse>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [busy, setBusy] = useState<"prediction" | "explanation" | null>(null);
  const [actionError, setActionError] = useState("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      const results = await Promise.allSettled([
        api.health(controller.signal),
        api.ready(controller.signal),
      ]);
      if (!controller.signal.aborted)
        setStatus(
          results[1].status === "fulfilled"
            ? "ready"
            : results[0].status === "fulfilled"
              ? "degraded"
              : "offline",
        );
      checking = false;
    }
    setLoading(true);
    setResourceError("");
    void Promise.all([
      api.metadata(controller.signal),
      api.schema(controller.signal),
    ])
      .then(([model, fields]) => {
        if (!controller.signal.aborted) {
          setMetadata(model);
          setSchema(fields);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResourceError(safeError(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    void check();
    const interval = setInterval(() => {
      void check();
    }, 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [reload]);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  const setDraft = useCallback((next: Draft) => {
    if (JSON.stringify(next) === JSON.stringify(draftRef.current)) return;
    draftRef.current = next;
    setDraftState(next);
    generation.current += 1;
    active.current?.abort();
    setBusy(null);
    setActionError("");
  }, []);
  const stale =
    !!snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot);
  const cancel = () => {
    generation.current += 1;
    active.current?.abort();
    setBusy(null);
  };
  async function run(
    kind: "prediction" | "explanation",
    payload: HeartRecord,
    captured: Draft,
  ) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const id = ++generation.current;
    setBusy(kind);
    setActionError("");
    try {
      const response =
        kind === "prediction"
          ? await api.predict(payload, controller.signal)
          : await api.explain(payload, controller.signal);
      if (generation.current !== id) return;
      setPrediction(response);
      setExplanation(
        "explanation" in response
          ? (response as ExplanationResponse)
          : undefined,
      );
      setSnapshot({ ...captured });
      setRecord({ ...payload });
    } catch (error) {
      if (
        generation.current === id &&
        !(error instanceof ApiError && error.code === "cancelled")
      )
        setActionError(safeError(error));
    } finally {
      if (generation.current === id) setBusy(null);
    }
  }
  return {
    metadata,
    schema,
    resourceError,
    loading,
    status,
    retry: () => setReload((n) => n + 1),
    draft,
    setDraft,
    prediction,
    explanation,
    stale,
    busy,
    actionError,
    cancel,
    predict: (payload: HeartRecord, captured: Draft) =>
      run("prediction", payload, captured),
    explain: () =>
      record && snapshot && !stale
        ? run("explanation", record, snapshot)
        : Promise.resolve(),
  };
}
type ResearchState = ReturnType<typeof useResearchState>;
const ResearchContext = createContext<ResearchState | null>(null);
export function ResearchProvider({ children }: { children: ReactNode }) {
  const value = useResearchState();
  return (
    <ResearchContext.Provider value={value}>
      {children}
    </ResearchContext.Provider>
  );
}
export function useResearch() {
  const value = useContext(ResearchContext);
  if (!value) throw new Error("ResearchProvider is required");
  return value;
}
