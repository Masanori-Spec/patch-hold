import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { solve } from "../src/solver.ts";
import { demo, cases } from "./helpers.mjs";
test("built browser module graph resolves JS imports and compiled engine matches source", async () => {
  const built = spawnSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "scripts/build.mjs"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(built.status, 0, built.stderr);
  const modules = [
    "core/model.js",
    "core/validation.js",
    "core/solver.js",
    "core/exports.js",
    "core/worker.js",
    "app.mjs",
    "example.mjs",
  ];
  for (const name of modules) {
    const url = new URL(`../dist/${name}`, import.meta.url),
      text = await readFile(url, "utf8");
    for (const match of text.matchAll(
      /\b(?:from|import)\s+(['"])([^'"]+)\1/g,
    )) {
      assert.ok(
        match[2].startsWith("./"),
        "No external browser module imports",
      );
      assert.ok(
        !match[2].endsWith(".ts"),
        "Built module must not request a source TypeScript file",
      );
      await access(new URL(match[2], url));
    }
  }
  const compiled = await import("../dist/core/solver.js");
  for (const p of [demo(), ...cases(30, 1024)]) {
    const a = solve(p, { maxMs: 0 }),
      b = compiled.solve(p, { maxMs: 0 });
    assert.equal(a.status, b.status);
    assert.equal(a.addressChanges, b.addressChanges);
    assert.deepEqual(a.assignment, b.assignment);
    assert.equal(a.work, b.work);
  }
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /script type="module" src="app.mjs"/);
  assert.match(html, /connect-src 'none'/);
});
