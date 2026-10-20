import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "./App";
import { mockApi, prediction, schema } from "./test/mocks";
import comparison from "./data/researchComparison.json";
function CurrentPath() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mockApi();
});
describe("multi-workspace platform", () => {
  it("introduces the platform with exactly three functional workspace cards and no API requests", () => {
    const fetchMock = mockApi();
    mount();
    expect(
      screen.getByRole("heading", { name: "MedIntel AI" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Intelligent Healthcare Research & Analysis Platform"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Enter Patient Workspace" }),
    ).toHaveAttribute("href", "/patient");
    expect(
      screen.getByRole("link", { name: "Enter Clinical Workspace" }),
    ).toHaveAttribute("href", "/doctor");
    expect(
      screen.getByRole("link", { name: "Enter Research Lab" }),
    ).toHaveAttribute("href", "/research");
    expect(screen.getByLabelText("Platform research notice")).toHaveTextContent(
      "does not provide medical diagnoses",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enters each workspace using the global selector and updates navigation and page titles", async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "patient",
    );
    expect(
      screen.getByRole("heading", {
        name: "Patient Health Information Portal",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Learn about health" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Heart prediction" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "doctor",
    );
    expect(
      screen.getByRole("heading", { name: "Clinical Research Workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Demonstration case" }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "research",
    );
    expect(
      screen.getByRole("heading", { name: "Your research, explained." }),
    ).toBeInTheDocument();
    expect(document.title).toContain("Researcher Workspace");
  });
  it("requires explicit file selection and acknowledgement before any report request", async () => {
    const fetchMock = mockApi();
    mount("/patient/reports");
    expect(
      screen.getByRole("button", { name: "Extract synthetic report" }),
    ).toBeDisabled();
    expect(document.querySelector("input[type=file]")).not.toBeNull();
    expect(
      screen.getByLabelText("Synthetic document privacy notice"),
    ).toHaveTextContent("Never upload real patient documents");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("shows all four educational concepts with trusted source links and no personal interpretation inputs", () => {
    mount("/patient/learn");
    for (const title of [
      "Hemoglobin",
      "Blood glucose",
      "Cholesterol",
      "Blood pressure",
    ])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    const sources = screen.getAllByRole("link", { name: /on MedlinePlus/ });
    expect(sources).toHaveLength(4);
    for (const link of sources)
      expect(link.getAttribute("href")).toMatch(
        /^https:\/\/medlineplus.gov\/lab-tests\//,
      );
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Patient education and privacy notice"),
    ).toHaveTextContent("Consult a qualified healthcare professional");
  });
  it("keeps every patient route educational with no automatic model calls or persistence", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    mount("/patient");
    for (const label of [
      "Report explorer",
      "Learn about health",
      "Privacy & information",
      "Overview",
    ])
      await user.click(
        within(screen.getByRole("navigation")).getByRole("link", {
          name: label,
        }),
      );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Run research prediction" }),
    ).not.toBeInTheDocument();
  });
  it("shows doctor scope, model availability and source-defined variable reference", async () => {
    const user = userEvent.setup();
    mount("/doctor");
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not verify professional credentials",
    );
    expect(
      await screen.findByText("Prediction and SHAP services are ready."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Clinical variables" }));
    expect(
      await screen.findByRole("heading", {
        name: "Clinical variable reference",
      }),
    ).toBeInTheDocument();
    for (const field of schema.fields)
      expect(
        screen.getByRole("heading", { name: field.label }),
      ).toBeInTheDocument();
    expect(screen.getByText(/not a thalassemia diagnosis/)).toBeInTheDocument();
  });
  it("groups all 13 clinical inputs and exposes keyboard-accessible technical definitions", async () => {
    const user = userEvent.setup();
    mount("/doctor/cases");
    await screen.findByRole("form");
    for (const group of [
      "Demographics",
      "Symptoms and history",
      "Clinical measurements",
      "Diagnostic test findings",
    ])
      expect(screen.getByRole("group", { name: group })).toBeInTheDocument();
    expect(document.querySelectorAll(".form-field")).toHaveLength(13);
    const help = screen.getByRole("button", { name: "About Age" });
    await user.click(help);
    expect(help).toHaveAccessibleDescription("Age at observation.");
    expect(within(help.parentElement!).getByRole("tooltip")).toHaveTextContent(
      "Age at observation.",
    );
    await user.keyboard("{Escape}");
    expect(within(help.parentElement!).getByRole("tooltip")).not.toHaveClass(
      "visible",
    );
  });
  it("reuses real contracts for doctor prediction, matching SHAP and stale-result handling", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    mount("/doctor/cases");
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
    const link = screen.getByRole("link", { name: "Explain this output" });
    expect(link).toHaveAttribute("href", "/doctor/explainability");
    await user.click(link);
    await user.click(
      await screen.findByRole("button", { name: "Generate SHAP explanation" }),
    );
    await screen.findByRole("heading", { name: "What moved this output?" });
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const predict = calls.find(([url]) =>
      url.endsWith("/predict/heart-disease"),
    )!;
    const explain = calls.find(([url]) =>
      url.endsWith("/explain/heart-disease"),
    )!;
    expect(JSON.parse(String(predict[1].body))).toEqual(
      JSON.parse(String(explain[1].body)),
    );
    await user.click(screen.getByRole("link", { name: "Demonstration case" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Age/ }), {
      target: { value: "56" },
    });
    expect(
      await screen.findByText(/This previous result no longer corresponds/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Explainability" }));
    expect(
      screen.getByRole("link", { name: "Update prediction" }),
    ).toHaveAttribute("href", "/doctor/cases");
  });
  it("shares a temporary analysis case between doctor and researcher, then clears it when leaving for patient education", async () => {
    const user = userEvent.setup();
    mount("/doctor/cases");
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
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "research",
    );
    await user.click(screen.getByRole("link", { name: "Explainability" }));
    expect(
      await screen.findByRole("button", { name: "Generate SHAP explanation" }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "patient",
    );
    expect(screen.queryByText("0.5591")).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Explore a workspace" }),
      "doctor",
    );
    await user.click(screen.getByRole("link", { name: "Demonstration case" }));
    await screen.findByRole("form");
    expect(screen.getByRole("spinbutton", { name: /Age/ })).toHaveValue(null);
    expect(
      screen.queryByRole("heading", {
        name: prediction.prediction.class_label,
      }),
    ).not.toBeInTheDocument();
  });
  it("renders verified comparison means and SDs for all three models separately from holdout results", async () => {
    mount("/research/models");
    const table = screen.getByRole("table", {
      name: /Historical training-only comparison/,
    });
    for (const model of comparison.models) {
      const row = within(table).getByRole("row", {
        name: new RegExp(model.model),
      });
      expect(row).toHaveTextContent(
        `${model.accuracy_mean.toFixed(3)} ± ${model.accuracy_std.toFixed(3)}`,
      );
      expect(row).toHaveTextContent(
        `${model.recall_mean.toFixed(3)} ± ${model.recall_std.toFixed(3)}`,
      );
    }
    expect(
      screen.getByText(
        /No held-out results were generated for the alternative models/,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("img", {
        name: /Historical holdout metric comparison/,
      }),
    ).toBeInTheDocument();
  });
  it("keeps experiments read-only and identifies the historical methodology", () => {
    mount("/research/experiments");
    expect(
      screen.getByRole("heading", { name: "The experiment record." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No new experiments/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /train|start experiment/i }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ["/predict", "/research/predict", "Explore a prediction."],
    ["/explainability", "/research/explainability", "Behind the output."],
    ["/model", "/research/methodology", "Know the model."],
  ])(
    "redirects the legacy route %s without losing its capability",
    async (oldPath, expectedPath, title) => {
      mount(oldPath);
      expect(
        await screen.findByRole("heading", { name: title }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        expectedPath,
      );
    },
  );
  it("keeps the patient education usable when the backend is unavailable", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("PRIVATE_TRACE")),
    );
    mount("/patient");
    expect(
      screen.getByRole("heading", {
        name: "Patient Health Information Portal",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("PRIVATE_TRACE");
  });
  it("shows a controlled backend error in the doctor workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("PRIVATE_TRACE")),
    );
    mount("/doctor/cases");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the backend",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_TRACE");
  });
  it("provides keyboard dismissal and active navigation for mobile workspaces", async () => {
    const user = userEvent.setup();
    mount("/patient");
    const menu = screen.getByRole("button", { name: "Toggle navigation" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
    await user.click(screen.getByRole("link", { name: "Learn about health" }));
    expect(
      screen.getByRole("link", { name: "Learn about health" }),
    ).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(document.title).toContain("Learn about health"));
  });
});
