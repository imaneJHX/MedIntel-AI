import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function checkAccessibility(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}
async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Toggle navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: label })
    .click();
}
test("live prediction, SHAP, navigation, stale state, keyboard access, and responsive layout", async ({
  page,
}, info) => {
  const issues: string[] = [];
  page.on("pageerror", (error) => issues.push(error.name));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      issues.push(`${message.type()}: ${message.text()}`);
  });
  await page.goto("/research");
  await expect(page.getByText("Backend ready")).toBeVisible();
  await expect(page.getByText("86.9%")).toBeVisible();
  await expect(page.getByLabel("Research disclaimer")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your research, explained." }),
  ).toBeVisible();
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({
    path: info.outputPath("overview.png"),
    fullPage: true,
  });
  await navigate(page, "Heart prediction");
  await expect(page.getByRole("form")).toBeVisible();
  await page.getByRole("button", { name: "Run research prediction" }).click();
  await expect(
    page.getByText("Enter a value or explicitly mark it unknown."),
  ).toHaveCount(13);
  await page.getByRole("button", { name: "Load fabricated example" }).click();
  await page.getByRole("button", { name: "Run research prediction" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Recorded heart disease present",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("0.5591", { exact: true })).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({
    path: info.outputPath("prediction.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explain this output" }).click();
  await page.getByRole("button", { name: "Generate SHAP explanation" }).click();
  await expect(
    page.getByRole("heading", { name: "What moved this output?" }),
  ).toBeVisible();
  await page
    .getByText("View all 28 contributions and transformed values", {
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("table", { name: "All individual feature contributions" })
      .getByRole("row"),
  ).toHaveCount(29);
  await page.getByRole("button", { name: "Show all 28" }).click();
  await checkAccessibility(page);
  await page.screenshot({
    path: info.outputPath("explanation.png"),
    fullPage: true,
  });
  await navigate(page, "Heart prediction");
  await page.getByRole("spinbutton", { name: "Age · years" }).fill("56");
  await expect(
    page.getByText(/This previous result no longer corresponds/),
  ).toBeVisible();
  await navigate(page, "Explainability");
  await expect(
    page.getByRole("link", { name: "Update prediction" }),
  ).toBeVisible();
  await navigate(page, "Model information");
  await expect(
    page.getByRole("heading", { name: "Know the model." }),
  ).toBeVisible();
  await checkAccessibility(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/research");
  await expect(
    page.getByRole("heading", { name: "Your research, explained." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(issues).toEqual([]);
});

test("API failures show an accessible recovery message", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.abort("failed"));
  await page.goto("/research");
  await expect(page.getByText("Backend offline")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot reach the backend",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
