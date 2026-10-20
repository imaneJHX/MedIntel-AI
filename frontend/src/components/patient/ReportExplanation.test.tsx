import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportExplanation } from "./ReportExplanation";
import { MeasurementReview } from "./MeasurementReview";
import { ReportUpload } from "./ReportUpload";
import english from "../../test/fixtures/report-explanation-en.json";
import french from "../../test/fixtures/report-explanation-fr.json";
import arabic from "../../test/fixtures/report-explanation-ar.json";
import extraction from "../../test/fixtures/report.json";
import { reportSchema } from "../../types/reports";
import {
  reportExplanationSchema,
  type ReviewedMeasurement,
} from "../../types/reportExplanations";
import { api } from "../../services/api";

const row = english.measurement_explanations[0];
const reviewed: ReviewedMeasurement = {
  id: row.measurement_id,
  name: row.source_name,
  value: row.value,
  unit: row.unit,
  reference_range: row.reference_range,
  reviewed: true,
  user_corrected: false,
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const mock = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/extract")) return response(extraction);
      const language = JSON.parse(String(options?.body)).language;
      return response(
        language === "fr" ? french : language === "ar" ? arabic : english,
      );
    }),
  );
async function generate() {
  const user = userEvent.setup();
  render(<ReportExplanation measurements={[reviewed]} total={3} />);
  await user.click(screen.getByRole("button", { name: "Explain My Report" }));
  await screen.findByRole("heading", { name: "Plain-language summary" });
  return user;
}
beforeEach(mock);

describe("grounded report explanations", () => {
  it("requires a reviewed measurement and truthfully labels offline templates", () => {
    render(<ReportExplanation measurements={[]} total={3} />);
    expect(
      screen.getByRole("button", { name: "Explain My Report" }),
    ).toBeDisabled();
    expect(screen.getByText(/No language model used/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows counts, facts, interval, questions, source links and disclaimers", async () => {
    await generate();
    expect(screen.getByText(english.summary)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Questions for a healthcare professional",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(english.questions_for_doctor[0].text),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Reviewed source/ }),
    ).toHaveAttribute("href", "#review-measurement-1");
    expect(
      screen.getAllByText(/Printed reference interval:/)[0],
    ).toHaveTextContent(">= 12 ; <= 16 g/dL");
    expect(screen.getByText(english.disclaimer)).toBeInTheDocument();
    expect(
      screen.getByText(/1 of 3 measurements reviewed/),
    ).toBeInTheDocument();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/reports\/explain$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      synthetic_only: true,
      language: "en",
      measurements: [reviewed],
    });
    expect(options?.credentials).toBe("omit");
    expect(String(options?.body)).not.toContain("source_text");
  });
  it.each([
    ["fr", french, "Résumé en langage clair"],
    ["ar", arabic, "ملخص بلغة مبسطة"],
  ] as const)(
    "switches to %s preserving facts without extraction",
    async (language, fixture, title) => {
      const user = await generate();
      await user.selectOptions(
        screen.getByLabelText("Explanation language"),
        language,
      );
      await screen.findByRole("heading", { name: title });
      expect(screen.getByText(fixture.summary)).toBeInTheDocument();
      const output = screen.getByText(fixture.summary).parentElement!;
      expect(output).toHaveAttribute("lang", language);
      expect(output).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
      expect(
        vi
          .mocked(fetch)
          .mock.calls.every(([url]) =>
            String(url).endsWith("/reports/explain"),
          ),
      ).toBe(true);
      const body = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
      expect(body.measurements).toEqual([reviewed]);
    },
  );
  it("changes language before explanation without an automatic API call", async () => {
    const user = userEvent.setup();
    render(<ReportExplanation measurements={[reviewed]} total={1} />);
    await user.selectOptions(
      screen.getByLabelText("Explanation language"),
      "fr",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([422, 503, 500])(
    "handles HTTP %s without displaying private errors",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            response({ error: { message: "PRIVATE_REPORT_TEXT" } }, status),
          ),
      );
      const user = userEvent.setup();
      render(<ReportExplanation measurements={[reviewed]} total={1} />);
      await user.click(
        screen.getByRole("button", { name: "Explain My Report" }),
      );
      await screen.findByRole("alert");
      expect(document.body).not.toHaveTextContent("PRIVATE_REPORT_TEXT");
      expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
    },
  );
  it("handles an API connection failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("private connection details")),
    );
    const user = userEvent.setup();
    render(<ReportExplanation measurements={[reviewed]} total={1} />);
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the backend",
    );
  });
  it.each([
    {},
    { ...english, counts: { ...english.counts, reviewed: 2 } },
    { ...english, measurement_explanations: [{ ...row, value: 999 }] },
    {
      ...english,
      measurement_explanations: [
        { ...row, source_measurement_ids: ["measurement-2"] },
      ],
    },
  ])("rejects malformed or contradictory responses", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
    const user = userEvent.setup();
    render(<ReportExplanation measurements={[reviewed]} total={1} />);
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    await screen.findByRole("alert");
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
  });
  it("shows loading, cancels, aborts and ignores a late response", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const user = userEvent.setup();
    render(<ReportExplanation measurements={[reviewed]} total={1} />);
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    expect(
      screen.getByRole("button", { name: /Explaining reviewed/ }),
    ).toBeDisabled();
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    await user.click(
      screen.getByRole("button", { name: "Cancel explanation" }),
    );
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(response(english)));
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
  });
  it("ignores a late old-language reply after switching language", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue(response(french)),
    );
    const user = userEvent.setup();
    render(<ReportExplanation measurements={[reviewed]} total={1} />);
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    await user.selectOptions(
      screen.getByLabelText("Explanation language"),
      "fr",
    );
    await screen.findByText(french.summary);
    await act(async () => finish(response(english)));
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
    expect(screen.getByText(french.summary)).toBeInTheDocument();
  });
  it("invalidates the explanation and confirmation immediately after an edit", async () => {
    const user = userEvent.setup();
    render(<MeasurementReview report={reportSchema.parse(extraction)} />);
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    await screen.findByText(english.summary);
    fireEvent.change(
      screen.getByLabelText("Measurement 1 result", { exact: true }),
      { target: { value: "13" } },
    );
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Explain My Report" }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Measurement 1 result", { exact: true }),
    ).toHaveValue("13");
  });
  it("aborts pending generation on edits and never restores the stale explanation", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const user = userEvent.setup();
    render(<MeasurementReview report={reportSchema.parse(extraction)} />);
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    fireEvent.change(
      screen.getByLabelText("Measurement 1 unit", { exact: true }),
      { target: { value: "g/L" } },
    );
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(response(english)));
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
  });
  it("clear report removes explanation and private session values", async () => {
    const user = userEvent.setup();
    render(<ReportUpload />);
    await user.upload(
      screen.getByLabelText("Choose synthetic report"),
      new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    await user.click(
      screen.getByRole("button", { name: "Extract synthetic report" }),
    );
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    await screen.findByText(english.summary);
    await user.click(screen.getByRole("button", { name: "Clear report" }));
    expect(screen.queryByText(english.summary)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
  it("bounds the request timeout and returns an actionable error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const pending = api
      .explainReport({
        synthetic_only: true,
        language: "en",
        measurements: [reviewed],
      })
      .catch((error) => error);
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await pending).code).toBe("timeout");
  });
  it("uses actual backend response fixtures for all three languages", () => {
    for (const fixture of [english, french, arabic])
      expect(reportExplanationSchema.safeParse(fixture).success).toBe(true);
  });
  it("aborts on unmount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const user = userEvent.setup();
    const view = render(
      <ReportExplanation measurements={[reviewed]} total={1} />,
    );
    await user.click(screen.getByRole("button", { name: "Explain My Report" }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
