import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
const pdf = fileURLToPath(
  new URL(
    "../public/samples/synthetic_routine_blood_count.pdf",
    import.meta.url,
  ),
);

test("reviewed PDF explanations in English, French and Arabic preserve corrected facts and clear stale state", async ({
  page,
}, info) => {
  const issues: string[] = [];
  const calls: string[] = [];
  page.on("pageerror", (e) => issues.push(e.name));
  page.on("console", (m) => {
    if (m.type() === "error") issues.push(m.text());
  });
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/")) calls.push(new URL(r.url()).pathname);
  });
  await page.goto("/patient/reports");
  await page.getByLabel("Choose synthetic report").setInputFiles(pdf);
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  await page.getByRole("button", { name: "Extract synthetic report" }).click();
  await expect(
    page.getByRole("button", { name: "Explain My Report" }),
  ).toBeDisabled();
  await page.getByLabel("Measurement 1 result", { exact: true }).fill("13");
  await page
    .getByRole("button", { name: "Confirm transcription", exact: true })
    .first()
    .click();
  const explanation = page.waitForResponse(
    (r) => r.url().endsWith("/reports/explain") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Explain My Report" }).click();
  const english = await (await explanation).json();
  expect(english.counts).toEqual({
    reviewed: 1,
    below_reported_interval: 0,
    within_reported_interval: 1,
    above_reported_interval: 0,
    not_evaluated: 0,
  });
  expect(english.measurement_explanations[0].value).toBe(13);
  expect(english.measurement_explanations[0].user_corrected).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Plain-language summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Reviewed source:/ }),
  ).toHaveAttribute("href", "#review-measurement-1");
  await page.getByRole("link", { name: /Reviewed source:/ }).click();
  await expect(page.locator("#review-measurement-1")).toBeInViewport();
  await page.getByLabel("Explanation language").selectOption("fr");
  await expect(
    page.getByRole("heading", { name: "Résumé en langage clair" }),
  ).toBeVisible();
  await page.getByLabel("Explanation language").selectOption("ar");
  await expect(
    page.getByRole("heading", { name: "ملخص بلغة مبسطة" }),
  ).toBeVisible();
  await expect(page.locator(".explanation-output")).toHaveAttribute(
    "dir",
    "rtl",
  );
  await expect(page.locator(".explanation-output")).toHaveAttribute(
    "lang",
    "ar",
  );
  await expect(
    page.getByLabel("Measurement 1 result", { exact: true }),
  ).toHaveValue("13");
  expect(calls.filter((p) => p === "/api/v1/reports/extract")).toHaveLength(1);
  expect(calls.filter((p) => p === "/api/v1/reports/explain")).toHaveLength(3);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("arabic-explanation.png"),
    fullPage: true,
  });
  await page.getByLabel("Measurement 1 result", { exact: true }).fill("14");
  await expect(page.locator(".explanation-output")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explain My Report" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear report", exact: true }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  expect(issues).toEqual([]);
});

test("pending explanations are discarded on edits and leaving the report route clears state", async ({
  page,
}) => {
  await page.goto("/patient/reports");
  await page.getByLabel("Choose synthetic report").setInputFiles(pdf);
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  await page.getByRole("button", { name: "Extract synthetic report" }).click();
  await page
    .getByRole("button", { name: "Confirm transcription", exact: true })
    .first()
    .click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/reports/explain", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole("button", { name: "Explain My Report" }).click();
  await expect(
    page.getByRole("button", { name: /Explaining reviewed/ }),
  ).toBeDisabled();
  await page.getByLabel("Measurement 1 result", { exact: true }).fill("13");
  release();
  await expect(page.locator(".explanation-output")).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Toggle navigation" });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) === "false"
  )
    await menu.click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) === "false"
  )
    await menu.click();
  await page
    .getByRole("link", { name: "Report explorer", exact: true })
    .click();
  await expect(page.getByLabel("Choose synthetic report")).toHaveValue("");
  await expect(page.getByRole("table")).toHaveCount(0);
});
