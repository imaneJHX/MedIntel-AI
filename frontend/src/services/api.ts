import { z } from "zod";
import { reportSchema } from "../types/reports";
import {
  reportExplanationSchema,
  type ReportExplanationRequest,
} from "../types/reportExplanations";
import { matchesReviewedFacts } from "../utils/reportExplanation";
import {
  healthSchema,
  readySchema,
  metadataSchema,
  inputSchema,
  predictionSchema,
  explanationSchema,
  type HeartRecord,
} from "../types/api";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    public code:
      | "network"
      | "validation"
      | "unavailable"
      | "response"
      | "timeout"
      | "cancelled",
    message: string,
    public fields: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Parse responses at the network boundary. Never display raw bodies or exceptions. */
async function request<T>(
  path: string,
  contract: z.ZodType<T>,
  signal?: AbortSignal,
  body?: HeartRecord | FormData | ReportExplanationRequest,
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: body ? "POST" : "GET",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      headers:
        body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : undefined,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    if (!response.ok) {
      if (path === "/api/v1/reports/explain") {
        throw new ApiError(
          response.status === 503 ? "unavailable" : "validation",
          response.status === 503
            ? "Educational explanations are temporarily unavailable. Try again shortly."
            : response.status === 413
              ? "The reviewed report exceeds the explanation request limit. Use a smaller synthetic example."
              : "Check that each included transcription is reviewed, uses a supported measurement name, finite numbers, ordered bounds and matching supported units. Choose English, French or Arabic.",
        );
      }
      if (path === "/api/v1/reports/extract") {
        let code = "";
        try {
          code = (await response.json()).error?.code ?? "";
        } catch {
          /* Never echo raw error bodies. */
        }
        const messages: Record<string, string> = {
          ocr_unavailable:
            "Local Tesseract OCR is not installed or configured. Upload a text-based PDF, or follow the Windows OCR setup in docs/medical_document_extraction.md.",
          ocr_failed:
            "Local OCR could not read this document. Check English language data and try a clearer synthetic example.",
          synthetic_marker_required:
            "The document must visibly contain SYNTHETIC TEST DOCUMENT. Real patient reports are prohibited.",
          synthetic_ack_required:
            "Confirm that the document contains no real personal or patient information.",
          encrypted_pdf:
            "Encrypted PDFs are not supported. Use an unencrypted synthetic example.",
          too_many_pages: "Use a PDF with at most five pages.",
          image_dimensions:
            "Use an image no larger than 4096 pixels per side and 8 million pixels.",
          report_busy:
            "Another synthetic report is processing. Please try again shortly.",
        };
        const message =
          messages[code] ??
          (response.status === 413
            ? "The document exceeds its file, page, pixel or text limits."
            : response.status === 408
              ? "Document processing timed out. Try a smaller synthetic report."
              : response.status === 415
                ? "Use a valid PDF, PNG or JPEG with matching file extension and contents."
                : response.status === 503
                  ? "The local document worker is unavailable. Check the backend setup."
                  : "This synthetic document could not be extracted. Check its format and use a supplied sample.");
        throw new ApiError(
          response.status === 503 ? "unavailable" : "response",
          message,
        );
      }
      if (response.status === 422)
        throw new ApiError(
          "validation",
          "The API could not accept these inputs. Check the supported ranges and categories, then try again.",
        );
      if (response.status === 503)
        throw new ApiError(
          "unavailable",
          "The requested model service is not ready. Check the backend and try again.",
        );
      throw new ApiError(
        "response",
        "The API could not complete this request. Please try again.",
      );
    }
    const parsed = contract.safeParse(await response.json());
    if (!parsed.success)
      throw new ApiError(
        "response",
        "The API returned an unexpected response format. Check that the frontend and backend versions match.",
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        timedOut ? "timeout" : "cancelled",
        timedOut
          ? "The request timed out. Please try again."
          : "Request cancelled.",
      );
    if (error instanceof SyntaxError)
      throw new ApiError(
        "response",
        "The API returned an unreadable response. Please try again.",
      );
    throw new ApiError(
      "network",
      "Cannot reach the backend. Check that FastAPI is running at the configured API address.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export const api = {
  explainReport: async (
    body: ReportExplanationRequest,
    signal?: AbortSignal,
  ) => {
    const result = await request(
      "/api/v1/reports/explain",
      reportExplanationSchema,
      signal,
      body,
    );
    if (!matchesReviewedFacts(result, body))
      throw new ApiError(
        "response",
        "The explanation did not match the reviewed measurements. No explanation was displayed. Please retry.",
      );
    return result;
  },
  extractReport: (file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    form.append("synthetic_only", "true");
    return request(
      "/api/v1/reports/extract",
      reportSchema,
      signal,
      form,
      60_000,
    );
  },
  health: (signal?: AbortSignal) =>
    request("/api/v1/health", healthSchema, signal),
  ready: (signal?: AbortSignal) =>
    request("/api/v1/ready", readySchema, signal),
  metadata: (signal?: AbortSignal) =>
    request("/api/v1/models/heart-disease", metadataSchema, signal),
  schema: (signal?: AbortSignal) =>
    request("/api/v1/models/heart-disease/schema", inputSchema, signal),
  predict: (body: HeartRecord, signal?: AbortSignal) =>
    request("/api/v1/predict/heart-disease", predictionSchema, signal, body),
  explain: (body: HeartRecord, signal?: AbortSignal) =>
    request("/api/v1/explain/heart-disease", explanationSchema, signal, body),
};
export const safeError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
