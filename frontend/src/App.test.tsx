import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { mockApi, prediction, explanation, schema } from "./test/mocks";
function mount(path = "/research") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mockApi();
});
describe("research workspace", () => {
  it("renders real historical highlights, disclaimers and ready status", async () => {
    mount();
    expect(
      screen.getByRole("heading", { name: "Your research, explained." }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Backend ready")).toBeInTheDocument();
    expect(await screen.findByText("86.9%")).toBeInTheDocument();
    expect(screen.getByText("303")).toBeInTheDocument();
    expect(
      screen.getByText("Historical records, not platform usage"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Research disclaimer")).toHaveTextContent(
      "not medical diagnoses",
    );
  });
  it("navigates through all pages and shows a useful missing route", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("link", { name: "Heart prediction" }));
    expect(
      await screen.findByRole("form", { name: "Heart disease research input" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Explainability" }));
    expect(
      await screen.findByRole("heading", {
        name: "Start with an observation.",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Model information" }));
    expect(
      screen.getByRole("heading", { name: "Know the model." }),
    ).toBeInTheDocument();
  });
  it("renders a not found page", () => {
    mount("/missing");
    expect(
      screen.getByRole("heading", { name: /isn’t in the workspace/ }),
    ).toBeInTheDocument();
  });
  it("renders all 13 accessible schema fields with their actual categories", async () => {
    mount("/predict");
    await screen.findByRole("form");
    for (const field of schema.fields)
      expect(document.getElementById(field.name)).toHaveAccessibleName(
        new RegExp(field.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    expect(
      screen.getByRole("option", { name: "Reversible defect (7)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a thalassemia diagnosis/)).toBeInTheDocument();
  });
  it("validates blanks and ranges without calling prediction", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    expect(
      await screen.findAllByText(
        "Enter a value or explicitly mark it unknown.",
      ),
    ).toHaveLength(13);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/predict/heart-disease"),
      ),
    ).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: /Age/ }), {
      target: { value: "28" },
    });
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    expect(
      await screen.findByText("Supported minimum: 29."),
    ).toBeInTheDocument();
  });
  it("submits a valid numeric record and renders class, score, threshold and identifier", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: prediction.prediction.class_label,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.5591")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText(prediction.model)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Experimental model score — not a clinically calibrated disease risk.",
      ),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/predict/heart-disease"),
      ),
    ).toHaveLength(1);
  });
  it("sends explicit unknown measurements as null without converting categorical zero", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(
      screen.getAllByRole("checkbox", {
        name: "Unknown (use training imputer)",
      })[0],
    );
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    await screen.findByRole("heading", {
      name: prediction.prediction.class_label,
    });
    const call = (
      fetchMock.mock.calls as unknown as [string, RequestInit][]
    ).find(([url]) => url.endsWith("/predict/heart-disease"))!;
    expect(JSON.parse(String(call[1].body))).toMatchObject({
      age: null,
      fbs: 0,
    });
  });
  it("marks edited results stale and prevents explanations until a new prediction", async () => {
    const user = userEvent.setup();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    await screen.findByRole("heading", {
      name: prediction.prediction.class_label,
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /Age/ }), {
      target: { value: "56" },
    });
    expect(
      await screen.findByText(/This previous result no longer corresponds/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explain this output" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("link", { name: "Explainability" }));
    expect(
      screen.queryByRole("button", { name: "Generate SHAP explanation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Update prediction" }),
    ).toBeInTheDocument();
  });
  it("requests matching SHAP input and renders all 28 signed contributions with correct units", async () => {
    const user = userEvent.setup();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    await user.click(
      await screen.findByRole("link", { name: "Explain this output" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Generate SHAP explanation" }),
    );
    expect(
      await screen.findByRole("heading", { name: "What moved this output?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(explanation.explanation.baseline_log_odds.toFixed(5)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not establish medical causation/),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "All individual feature contributions",
      hidden: true,
    });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(
      29,
    );
    await user.click(screen.getByRole("button", { name: "Show all 28" }));
    expect(screen.getByRole("button", { name: "Show top 10" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("handles offline status, errors and recovery without showing sensitive exception text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("PRIVATE_INPUT_MARKER")),
    );
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the backend",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_INPUT_MARKER");
    mockApi();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Backend ready")).toBeInTheDocument();
    expect(await screen.findByText("86.9%")).toBeInTheDocument();
  });
  it("shows degraded state when liveness works but readiness fails", async () => {
    const fetchMock = mockApi();
    const original = fetchMock.getMockImplementation()!;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL | Request) =>
        String(url).endsWith("/ready")
          ? Promise.resolve(new Response("{}", { status: 503 }))
          : original(url),
      ),
    );
    mount();
    expect(await screen.findByText("Backend degraded")).toBeInTheDocument();
  });
  it("shows loading and cancellation, and ignores a late prediction after edits", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    const original = fetchMock.getMockImplementation()!;
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL | Request) =>
        String(url).endsWith("/predict/heart-disease")
          ? new Promise<Response>((done) => {
              resolve = done;
            })
          : original(url),
      ),
    );
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Run research prediction" }),
    );
    expect(
      screen.getByRole("button", { name: "Running prediction…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Age/ }), {
      target: { value: "56" },
    });
    resolve(new Response(JSON.stringify(prediction)));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run research prediction" }),
      ).toBeEnabled(),
    );
    expect(
      screen.queryByRole("heading", {
        name: prediction.prediction.class_label,
      }),
    ).not.toBeInTheDocument();
  });
  it("keeps drafts across navigation, clears deliberately, and exposes mobile navigation controls", async () => {
    const user = userEvent.setup();
    mount("/predict");
    await screen.findByRole("form");
    await user.click(
      screen.getByRole("button", { name: "Load fabricated example" }),
    );
    await user.click(screen.getByRole("link", { name: "Overview" }));
    await user.click(screen.getByRole("link", { name: "Heart prediction" }));
    expect(screen.getByRole("spinbutton", { name: /Age/ })).toHaveValue(55);
    await user.click(screen.getByRole("button", { name: "Clear inputs" }));
    expect(screen.getByRole("spinbutton", { name: /Age/ })).toHaveValue(null);
    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
