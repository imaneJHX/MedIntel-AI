import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openNavigation(page: Page) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
}
async function navigate(page: Page, label: string) {
  await openNavigation(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
}
async function switchWorkspace(page: Page, workspace: string) {
  await openNavigation(page);
  await page
    .getByRole("combobox", { name: "Explore a workspace" })
    .selectOption(workspace);
}
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}
function monitor(page: Page) {
  const issues: string[] = [];
  page.on("pageerror", (error) => issues.push(error.name));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      issues.push(message.text());
  });
  return issues;
}
test("landing and patient education make no automatic API requests and require upload acknowledgement", async ({
  page,
}, info) => {
  const issues = monitor(page);
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) apiCalls.push(request.method());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "MedIntel AI", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Enter / })).toHaveCount(3);
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("landing.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Enter Patient Workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Patient Health Information Portal" }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("patient-home.png"),
    fullPage: true,
  });
  await navigate(page, "Report explorer");
  await expect(
    page.getByRole("button", { name: "Extract synthetic report" }),
  ).toBeDisabled();
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Medical Report Explorer" }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("report-preview.png"),
    fullPage: true,
  });
  await navigate(page, "Learn about health");
  for (const title of [
    "Hemoglobin",
    "Blood glucose",
    "Cholesterol",
    "Blood pressure",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  await expect(page.getByRole("link", { name: /on MedlinePlus/ })).toHaveCount(
    4,
  );
  await accessible(page);
  await navigate(page, "Privacy & information");
  await expect(
    page.getByRole("heading", { name: "Privacy and your learning space" }),
  ).toBeVisible();
  await accessible(page);
  expect(apiCalls).toEqual([]);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  expect(issues).toEqual([]);
});

test("doctor case reuses prediction and SHAP, shares analysis state, and clears it on leaving for patient education", async ({
  page,
}, info) => {
  const issues = monitor(page);
  await page.goto("/doctor");
  await expect(
    page.getByRole("heading", { name: "Clinical Research Workspace" }),
  ).toBeVisible();
  await expect(page.getByText("Backend ready")).toBeVisible();
  await accessible(page);
  await page
    .getByRole("link", { name: "Explore a demonstration case" })
    .click();
  for (const group of [
    "Demographics",
    "Symptoms and history",
    "Clinical measurements",
    "Diagnostic test findings",
  ])
    await expect(page.getByRole("group", { name: group })).toBeVisible();
  await page.getByRole("button", { name: "About Age" }).click();
  await expect(
    page.getByRole("tooltip", { name: "Age at observation." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Load fabricated example" }).click();
  await page.getByRole("button", { name: "Run research prediction" }).click();
  await expect(page.getByText("0.5591", { exact: true })).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("doctor-case.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explain this output" }).click();
  await expect(page).toHaveURL(/\/doctor\/explainability$/);
  await page.getByRole("button", { name: "Generate SHAP explanation" }).click();
  await expect(
    page.getByRole("heading", { name: "What moved this output?" }),
  ).toBeVisible();
  await accessible(page);
  await switchWorkspace(page, "research");
  await expect(
    page.getByRole("heading", { name: "Your research, explained." }),
  ).toBeVisible();
  await navigate(page, "Explainability");
  await expect(
    page.getByRole("heading", { name: "What moved this output?" }),
  ).toBeVisible();
  await switchWorkspace(page, "patient");
  await expect(
    page.getByRole("heading", { name: "Patient Health Information Portal" }),
  ).toBeVisible();
  await expect(page.getByText("0.5591", { exact: true })).toHaveCount(0);
  await switchWorkspace(page, "doctor");
  await navigate(page, "Demonstration case");
  await expect(
    page.getByRole("spinbutton", { name: "Age · years" }),
  ).toBeEmpty();
  await expect(page.getByText("0.5591", { exact: true })).toHaveCount(0);
  expect(issues).toEqual([]);
});

test("research comparison, variable reference, scope pages and legacy routes remain accessible", async ({
  page,
}, info) => {
  const issues = monitor(page);
  await page.goto("/research/models");
  await expect(page.getByText("Backend ready")).toBeVisible();
  const table = page.getByRole("table", {
    name: /Historical training-only comparison/,
  });
  await expect(table.getByRole("row")).toHaveCount(4);
  for (const name of ["Logistic Regression", "Random Forest", "XGBoost"])
    await expect(
      table.getByRole("row", { name: new RegExp(name) }),
    ).toBeVisible();
  await expect(table).toContainText("0.810 ± 0.069");
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("research-models.png"),
    fullPage: true,
  });
  await navigate(page, "Experiments");
  await expect(
    page.getByRole("heading", { name: "The experiment record." }),
  ).toBeVisible();
  await accessible(page);
  await switchWorkspace(page, "doctor");
  await navigate(page, "Clinical variables");
  await expect(
    page.getByRole("heading", { name: "Thallium-test result", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await navigate(page, "Scope & limitations");
  await expect(
    page.getByRole("heading", { name: "Clinical workspace limitations" }),
  ).toBeVisible();
  await accessible(page);
  await page.goto("/predict");
  await expect(page).toHaveURL(/\/research\/predict$/);
  await expect(page.getByRole("form")).toBeVisible();
  await page.goto("/model");
  await expect(page).toHaveURL(/\/research\/methodology$/);
  await expect(
    page.getByRole("heading", { name: "Know the model." }),
  ).toBeVisible();
  await page.goto("/explainability");
  await expect(page).toHaveURL(/\/research\/explainability$/);
  await expect(
    page.getByRole("heading", { name: "Start with an observation." }),
  ).toBeVisible();
  expect(issues).toEqual([]);
});
