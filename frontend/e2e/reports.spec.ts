import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
const pdf = fileURLToPath(
  new URL(
    "../public/samples/synthetic_routine_blood_count.pdf",
    import.meta.url,
  ),
);
const png = fileURLToPath(
  new URL("../public/samples/synthetic_lipid_panel.png", import.meta.url),
);
test("real synthetic PDF upload, explicit review, editing, clearing and accessibility", async ({
  page,
}, info) => {
  const issues: string[] = [];
  const endpoints: string[] = [];
  page.on("pageerror", (error) => issues.push(error.name));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      issues.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/"))
      endpoints.push(new URL(request.url()).pathname);
  });
  await page.goto("/patient/reports");
  await expect(
    page.getByRole("heading", { name: "Medical Report Explorer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extract synthetic report" }),
  ).toBeDisabled();
  await page.getByLabel("Choose synthetic report").setInputFiles(pdf);
  await expect(
    page.getByRole("button", { name: "Extract synthetic report" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/reports/extract") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Extract synthetic report" }).click();
  const payload = await (await response).json();
  expect(payload.measurements).toHaveLength(3);
  expect(payload.measurements[0].value).toBe(11.2);
  await expect(
    page.getByRole("heading", { name: "Review extracted measurements" }),
  ).toBeVisible();
  await expect(
    page.getByText("Below reported interval", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Confirm a transcription to display/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm transcription", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Transcription reviewed · Original extraction"),
  ).toBeVisible();
  await expect(
    page.getByText(/Hemoglobin is an oxygen-carrying protein/),
  ).toBeVisible();
  await page.getByLabel("Measurement 1 result", { exact: true }).fill("13");
  await expect(page.getByText("Needs review · Manually edited")).toBeVisible();
  await expect(
    page.getByText("Within reported interval", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText(/Confirm a transcription to display/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm transcription", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Transcription reviewed · Manually edited"),
  ).toBeVisible();
  await page
    .getByLabel("Measurement 1 reference unit", { exact: true })
    .fill("g/L");
  await expect(page.getByText("Not evaluated", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Reset measurement 1", exact: true })
    .click();
  await expect(
    page.getByLabel("Measurement 1 result", { exact: true }),
  ).toHaveValue("11.2");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    scrollTo(0, 0);
  });
  await page.screenshot({
    path: info.outputPath("synthetic-review.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clear report", exact: true }).click();
  await expect(page.getByLabel("Choose synthetic report")).toHaveValue("");
  await expect(
    page.getByRole("checkbox", { name: /I confirm/ }),
  ).not.toBeChecked();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(endpoints).toEqual(["/api/v1/reports/extract"]);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  expect(issues).toEqual([]);
});

test("image upload reports missing OCR honestly or returns local OCR results when configured", async ({
  page,
}) => {
  await page.goto("/patient/reports");
  await page.getByLabel("Choose synthetic report").setInputFiles(png);
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/reports/extract"),
  );
  await page.getByRole("button", { name: "Extract synthetic report" }).click();
  const result = await response;
  if (result.status() === 503) {
    expect((await result.json()).error.code).toBe("ocr_unavailable");
    await expect(page.getByRole("alert")).toContainText(
      "Local Tesseract OCR is not installed",
    );
    await expect(page.getByRole("table")).toHaveCount(0);
  } else {
    expect(result.status()).toBe(200);
    expect((await result.json()).extraction_method).toBe("local_ocr");
  }
});
