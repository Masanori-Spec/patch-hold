import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const ready = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
};
test("worked example, bilingual labels, mobile overflow, all exports and print content", async ({
  page,
}) => {
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
  for (const [name, needle] of [
    ["Full patch CSV", '"B"'],
    ["Changes-only CSV", "mode/footprint"],
    ["Printable cards HTML", "U1 · 7–10"],
    ["Plan JSON", "patchhold-manifest"],
  ]) {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const dl = await event,
      bytes = await readFile(await dl.path(), "utf8");
    expect(bytes).toContain(needle);
  }
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("#export-patch")).toHaveText("完全パッチ CSV");
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
