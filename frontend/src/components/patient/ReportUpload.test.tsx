import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportUpload } from "./ReportUpload";
import fixture from "../../test/fixtures/report.json";
import { reportSchema } from "../../types/reports";
const file = () =>
  new File(["%PDF-1.7 synthetic"], "synthetic.pdf", {
    type: "application/pdf",
  });
const mock = (body: unknown = fixture, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  );
const acknowledge = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    screen.getByRole("checkbox", {
      name: /I confirm this is a synthetic demonstration/,
    }),
  );
async function extract() {
  const user = userEvent.setup();
  render(<ReportUpload />);
  await user.upload(screen.getByLabelText("Choose synthetic report"), file());
  await acknowledge(user);
  await user.click(
    screen.getByRole("button", { name: "Extract synthetic report" }),
  );
  return user;
}
beforeEach(() => mock());
describe("synthetic document workflow", () => {
  it("renders four steps, synthetic-only warning, limits and acknowledgement gate", () => {
    render(<ReportUpload />);
    expect(
      screen.getByRole("list", { name: "Report exploration workflow" }),
    ).toHaveTextContent("Upload");
    expect(screen.getByText(/maximum 5 MiB/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Extract synthetic report" }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Synthetic document privacy notice"),
    ).toHaveTextContent("Never upload real patient documents");
  });
  it("selects a file and sends multipart only after explicit acknowledgement", async () => {
    const user = userEvent.setup();
    render(<ReportUpload />);
    await user.upload(screen.getByLabelText("Choose synthetic report"), file());
    expect(screen.getByText("synthetic.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Extract synthetic report" }),
    ).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
    await acknowledge(user);
    await user.click(
      screen.getByRole("button", { name: "Extract synthetic report" }),
    );
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toMatch(/\/api\/v1\/reports\/extract$/);
    const options = call[1]!,
      body = options.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("synthetic_only")).toBe("true");
    expect(options.headers).toBeUndefined();
    expect(options.credentials).toBe("omit");
  });
  it("supports drag and drop without automatically sending a document", () => {
    render(<ReportUpload />);
    fireEvent.drop(
      screen.getByText("Drop one synthetic report here").parentElement!,
      { dataTransfer: { files: [file()] } },
    );
    expect(screen.getByText("synthetic.pdf")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [
      new File(["bad"], "report.exe", { type: "application/octet-stream" }),
      /matching file type/,
    ],
    [new File([], "empty.pdf", { type: "application/pdf" }), /non-empty/],
    [
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
        type: "application/pdf",
      }),
      /no larger than 5 MiB/,
    ],
  ])("rejects invalid file selection %#", (candidate, message) => {
    render(<ReportUpload />);
    fireEvent.change(screen.getByLabelText("Choose synthetic report"), {
      target: { files: [candidate] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects multiple dropped documents", () => {
    render(<ReportUpload />);
    fireEvent.drop(
      screen.getByText("Drop one synthetic report here").parentElement!,
      { dataTransfer: { files: [file(), file()] } },
    );
    expect(screen.getByRole("alert")).toHaveTextContent("exactly one");
  });
  it("parses the actual backend fixture and displays extraction method and review requirements", async () => {
    expect(reportSchema.safeParse(fixture).success).toBe(true);
    await extract();
    expect(
      await screen.findByRole("heading", {
        name: "Review extracted measurements",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Embedded PDF text/)).toBeInTheDocument();
    expect(screen.getByLabelText("Measurement 1 result")).toHaveValue("11.2");
    expect(screen.getByText("Below reported interval")).toBeInTheDocument();
    expect(screen.getAllByText(/Needs review/)).toHaveLength(3);
    expect(
      screen.getByText(/Confirm a transcription to display/),
    ).toBeInTheDocument();
  });
  it("preserves original extraction while edits recalculate interval comparison and reset confirmation", async () => {
    const user = await extract();
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    expect(
      screen.getByText("Transcription reviewed · Original extraction"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hemoglobin is an oxygen-carrying protein/),
    ).toBeInTheDocument();
    const result = screen.getByLabelText("Measurement 1 result");
    await user.clear(result);
    await user.type(result, "13");
    expect(
      screen.getByText("Needs review · Manually edited"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Within reported interval")).toHaveLength(2);
    expect(
      screen.getByText(/Confirm a transcription to display/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fixture.measurements[0].source_text),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Reset measurement 1" }),
    );
    expect(result).toHaveValue("11.2");
    expect(screen.getByText("Below reported interval")).toBeInTheDocument();
  });
  it("revalidates manual corrections and refuses reversed intervals", async () => {
    const user = await extract();
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    const lower = screen.getByLabelText("Measurement 1 lower bound");
    await user.clear(lower);
    await user.type(lower, "20");
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "lower reference bound must not exceed",
    );
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(
      screen.queryByText("Transcription reviewed · Manually edited"),
    ).not.toBeInTheDocument();
  });
  it("does not compare incompatible units or generate a definition for an unknown corrected name", async () => {
    const user = await extract();
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    const unit = screen.getByLabelText("Measurement 1 unit");
    await user.clear(unit);
    await user.type(unit, "g/L");
    expect(
      screen.getByText("Different units: no comparison or conversion."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    const name = screen.getByLabelText("Measurement 1 name");
    await user.clear(name);
    await user.type(name, "Unrecognized term");
    await user.click(
      screen.getAllByRole("button", { name: "Confirm transcription" })[0],
    );
    expect(
      screen.getByText(/No educational definition is available/),
    ).toBeInTheDocument();
  });
  it("handles an empty extraction without fabricating table rows", async () => {
    mock({ ...fixture, measurements: [] });
    await extract();
    expect(
      await screen.findByRole("heading", {
        name: "No supported measurements found",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("shows missing OCR instructions and sanitized errors", async () => {
    mock(
      { error: { code: "ocr_unavailable", message: "PRIVATE_INTERNAL_PATH" } },
      503,
    );
    await extract();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Local Tesseract OCR is not installed",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_INTERNAL_PATH");
  });
  it("shows indeterminate processing, cancels and ignores late responses", async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    const user = await extract();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No progress percentage is estimated",
    );
    await user.click(screen.getByRole("button", { name: "Cancel and clear" }));
    complete(new Response(JSON.stringify(fixture)));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Extract synthetic report" }),
      ).toBeDisabled(),
    );
    expect(
      screen.queryByRole("heading", { name: "Review extracted measurements" }),
    ).not.toBeInTheDocument();
  });
  it("clears all report, correction, acknowledgement and file state without browser persistence", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const user = await extract();
    await screen.findByRole("heading", {
      name: "Review extracted measurements",
    });
    await user.click(screen.getByRole("button", { name: "Clear report" }));
    expect(screen.getByLabelText("Choose synthetic report")).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: /I confirm/ }),
    ).not.toBeChecked();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(storage).not.toHaveBeenCalled();
  });
});
