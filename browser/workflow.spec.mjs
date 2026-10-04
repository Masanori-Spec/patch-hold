import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const ready = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
};
test("worked example, bilingual labels, mobile overflow, all exports and print content", async ({
  page, context,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(
    page.getByRole("heading", {
      name: "Change only the addresses you need to.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Generate plan", exact: true })
    .click();
  await expect(page.locator("#status-badge")).toHaveText("MINIMUM PROVEN");
  await expect(page.locator("#result-table")).toContainText("U1:7–10");
  await expect(page.locator("#result-table")).toContainText("mode/footprint");
  await page.screenshot({ path: testInfo.outputPath("worked-en.png"), fullPage: true });
  await page.locator("#result-panel").screenshot({ path: testInfo.outputPath("result-en.png") });
  const downloaded = {}, evidence = [];
  for (const [name, filename] of [
    ["Full patch CSV", "patch.csv"],
    ["Changes-only CSV", "changes.csv"],
    ["Printable cards HTML", "address-cards.html"],
    ["Plan JSON", "project.json"],
  ]) {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const dl = await event, output = testInfo.outputPath(filename);
    expect(await dl.failure()).toBeNull();
    await dl.saveAs(output);
    const bytes = await readFile(output);
    downloaded[filename] = output;
    evidence.push({ filename, suggestedFilename: dl.suggestedFilename(), bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") });
    const golden = await readFile(new URL(`../examples/worked-kit/${filename}`, import.meta.url));
    if (filename !== "project.json") expect(bytes.equals(golden)).toBe(true);
    else {
      const actual = JSON.parse(bytes.toString()), expected = JSON.parse(golden.toString());
      expect(actual.kind).toBe("patchhold-manifest");
      expect(actual.project).toEqual(expected.project);
      expect(actual.result.status).toBe("minimum_proven");
      expect(actual.result.addressChanges).toBe(1);
      expect(actual.result.assignment).toEqual(expected.result.assignment);
      expect(actual.result.input).toBe(expected.result.input);
      expect(JSON.parse(actual.result.input)).toEqual(actual.project);
    }
  }
  await writeFile(testInfo.outputPath("download-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const cards = await context.newPage();
  await cards.goto(pathToFileURL(downloaded["address-cards.html"]).href);
  await expect(cards.locator(".card")).toHaveCount(4);
  await expect(cards.locator(".address")).toHaveText(["U1 · 1–6", "U1 · 7–10", "U1 · 12–16", "U1 · 11–11"]);
  await expect(cards.locator("body")).toContainText("1 existing address changes");
  await cards.emulateMedia({ media: "print" });
  await cards.screenshot({ path: testInfo.outputPath("printed-address-cards.png"), fullPage: true });
  await cards.pdf({ path: testInfo.outputPath("printed-address-cards.pdf"), format: "A4", printBackground: true });
  await cards.close();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("#export-patch")).toHaveText("完全パッチ CSV");
  await page.screenshot({ path: testInfo.outputPath("worked-ja.png"), fullPage: true });
  await page.locator("#import").setInputFiles(downloaded["project.json"]);
  await expect(page.locator("#export-patch")).toBeDisabled();
  await expect(page.locator("#result-table")).toBeEmpty();
  await page.locator("#generate").click();
  await expect(page.locator("#status-badge")).toHaveText("MINIMUM PROVEN");
  expect(errors).toEqual([]);
});
test("edit, repeated generation, cancellation and stale export invalidation", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#generate").click();
  await expect(page.locator("#export-patch")).toBeEnabled();
  await page.getByLabel("desired A Channels", { exact: true }).fill("7");
  await expect(page.locator("#export-patch")).toBeDisabled();
  await expect(page.locator("#result-table")).toBeEmpty();
  await page.locator("#generate").click();
  await page.locator("#generate").click();
  await expect(page.locator("#status-badge")).toHaveText("MINIMUM PROVEN");
  await expect(page.locator("#export-patch")).toBeEnabled();
  await page.evaluate(() => {
    document.getElementById("generate").click();
    const cancel = document.getElementById("cancel");
    if (cancel.disabled)
      throw new Error("Cancel should be enabled synchronously");
    cancel.click();
  });
  await expect(page.locator("#status-badge")).toHaveText("CANCELLED");
  await expect(page.locator("#export-patch")).toBeDisabled();
  await expect(page.locator("#result-table")).toBeEmpty();
  await page.waitForTimeout(100);
  await expect(page.locator("#status-badge")).toHaveText("CANCELLED");
  await expect(page.locator("#export-patch")).toBeDisabled();
  await page.locator("#title").fill("edited after run");
  await expect(page.locator("#export-patch")).toBeDisabled();
});
test("keyboard-only generation, invalid lock collision and bounded search", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#generate").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#status-badge")).toHaveText("MINIMUM PROVEN");
  await page.getByLabel("desired A Address lock", { exact: true }).check();
  await page.getByLabel("desired B Address lock", { exact: true }).check();
  await page.locator("#generate").click();
  await expect(page.locator("#status-badge")).toHaveText("NO SOLUTION PROVEN");
  await expect(page.locator("#export-patch")).toBeDisabled();
  await page.locator("#demo").click();
  await page.locator("#nodes").fill("1");
  await page.locator("#generate").click();
  await expect(page.locator("#status-badge")).toHaveText("BUDGET EXHAUSTED");
  await expect(page.locator("#status")).toContainText(
    "does not prove impossibility",
  );
});
test("JSON import is local, escaped text remains text, and navigation does not restore stale plans", async ({
  page,
}) => {
  await ready(page);
  const sample = JSON.parse(
    await readFile(new URL("../examples/worked.json", import.meta.url), "utf8"),
  );
  sample.desired[0].name = "<img src=x onerror=alert(1)>";
  await page
    .locator("#import")
    .setInputFiles({
      name: "fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(sample)),
    });
  await expect(page.getByLabel("desired A Name", { exact: true })).toHaveValue(
    sample.desired[0].name,
  );
  await page.locator("#generate").click();
  await expect(page.locator("#status-badge")).toHaveText("MINIMUM PROVEN");
  await expect(page.locator("#result-table img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#export-patch")).toBeDisabled();
});
