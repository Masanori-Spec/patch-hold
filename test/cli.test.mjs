import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
function run(args) {
  return spawnSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "src/cli.mjs", ...args],
    { cwd, encoding: "utf8", timeout: 20000 },
  );
}
test("CLI produces four outputs and refuses any existing output directory or symlink", () => {
  const dir = mkdtempSync(join(tmpdir(), "patchhold-test-"));
  try {
    const out = join(dir, "kit"),
      args = ["examples/worked.json", "--ms", "0", "--out", out];
    let r = run(args);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readdirSync(out).sort(), [
      "address-cards.html",
      "changes.csv",
      "patch.csv",
      "project.json",
    ]);
    const original = readFileSync(join(out, "patch.csv"), "utf8");
    r = run(args);
    assert.equal(r.status, 5);
    assert.equal(readFileSync(join(out, "patch.csv"), "utf8"), original);
    const link = join(dir, "link");
    symlinkSync(out, link);
    assert.equal(run(["examples/worked.json", "--out", link]).status, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("CLI budget exit codes, input errors and no partial exports for unproven feasibility", () => {
  const dir = mkdtempSync(join(tmpdir(), "patchhold-test-"));
  try {
    let r = run([
      "examples/worked.json",
      "--nodes",
      "1",
      "--out",
      join(dir, "none"),
    ]);
    assert.equal(r.status, 4);
    assert.deepEqual(readdirSync(dir), []);
    writeFileSync(join(dir, "bad.json"), '{"schemaVersion":2}');
    assert.equal(run([join(dir, "bad.json")]).status, 5);
    writeFileSync(join(dir, "large.json"), " ".repeat(1500001));
    assert.equal(run([join(dir, "large.json")]).status, 5);
    assert.equal(run(["examples/worked.json", "--nodes", "1.5"]).status, 5);
    assert.equal(
      run(["examples/worked.json", "--out", "x", "--out", "y"]).status,
      5,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
