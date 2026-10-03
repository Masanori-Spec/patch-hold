import test from "node:test";
import assert from "node:assert/strict";
import { solve } from "../src/solver.ts";
import {
  patchCsv,
  changesCsv,
  addressCards,
  manifest,
  csvCell,
  safeFilename,
  changeRows,
} from "../src/exports.ts";
import { parseProject, canonicalProject } from "../src/validation.ts";
import { demo, base, want } from "./helpers.mjs";
function readCsv(text) {
  text = text.replace(/^\ufeff/, "");
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (c === "\r" && !quoted && text[i + 1] === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      i++;
    } else value += c;
  }
  return rows;
}
test("all four outputs reflect the same assignment and honest status", () => {
  const p = demo(),
    r = solve(p),
    csv = readCsv(patchCsv(p, r)),
    rows = changeRows(p, r);
  assert.equal(csv.length, 5);
  for (const f of rows) {
    const row = csv.find((row) => row[0] === f.id);
    assert.equal(row[3], String(f.universe));
    assert.equal(row[4], String(f.start));
    assert.equal(row[5], String(f.end));
    assert.equal(row[13], r.status);
  }
  assert.deepEqual(parseProject(manifest(p, r)), parseProject(manifest(p)));
  assert.equal(
    canonicalProject(parseProject(manifest(p, r))),
    canonicalProject(p),
  );
  assert.ok(addressCards(p, r).includes("U1 · 7–10"));
});
test("mode-only changes included; unchanged address is not unchanged work", () => {
  const p = demo(),
    r = solve(p),
    csv = readCsv(changesCsv(p, r)),
    row = csv.find((r) => r[0] === "A");
  assert.ok(row[3].includes("mode/footprint"));
  assert.equal(row[7], row[9]);
  assert.match(row[13], /mode\/footprint/);
  assert.equal(
    csv.some((r) => r[0] === "C"),
    false,
  );
});
test("removal, rename and new-fixture checklist", () => {
  const p = demo();
  p.desired = p.desired.filter((f) => f.id !== "C");
  p.desired[1].name = "Renamed";
  const r = solve(p),
    rows = changeRows(p, r);
  assert.equal(rows.find((f) => f.id === "C").action, "removed");
  assert.ok(rows.find((f) => f.id === "B").action.includes("label/location"));
  assert.equal(rows.find((f) => f.id === "D").action, "new");
  assert.ok(!readCsv(patchCsv(p, r)).some((f) => f[0] === "C"));
  assert.match(addressCards(p, r), /REMOVE/);
});
test("formula prefixes including whitespace and control prefixes are neutralized", () => {
  for (const v of [
    "=SUM(A1:A2)",
    "+1",
    "-1",
    "@A1",
    "  =1",
    "\t=1",
    "\n+1",
    "\r@a",
    "\u0001=1",
    "\u0085=1",
  ]) {
    const out = readCsv(csvCell(v) + "\r\n")[0][0];
    assert.equal(out, "'" + v);
  }
  assert.equal(readCsv(csvCell('a,"b"\nc') + "\r\n")[0][0], 'a,"b"\nc');
});
test("HTML strings escaped and no active user markup, URL or script inserted", () => {
  const p = demo();
  p.desired[0].name = '<img src=x onerror="alert(1)">';
  p.desired[0].mode = "<script>alert(1)</script>";
  p.title = "</title><script>x</script>";
  const r = solve(p),
    cards = addressCards(p, r);
  assert.ok(!cards.includes("<script>"));
  assert.ok(!cards.includes("<img"));
  assert.ok(cards.includes("&lt;script&gt;"));
  assert.ok(cards.includes("default-src 'none'"));
});
test("sanitized bounded filenames, input-only manifests and stale export rejection", () => {
  for (const name of [
    "../../etc/passwd",
    "CON\0<script>",
    "日本語",
    "a".repeat(1000),
  ]) {
    const s = safeFilename(name);
    assert.match(s, /^[A-Za-z0-9_-]{1,48}$/);
  }
  const p = demo(),
    r = solve(p);
  const m = JSON.parse(manifest(p, r));
  m.result.assignment[0].start = 500;
  assert.equal(parseProject(JSON.stringify(m)).baseline[0].start, 1);
  assert.equal(JSON.parse(manifest(p)).result, undefined);
  p.desired[0].mode = "new";
  for (const fn of [patchCsv, changesCsv, addressCards, manifest])
    assert.throws(() => fn(p, r));
});

test("maximum supported Unicode project and result manifest fit the import byte cap and round-trip", () => {
  const p = {
    schemaVersion: 1,
    title: "界".repeat(160),
    universes: [1, 2],
    baseline: [],
    desired: [],
    reservations: [],
  };
  for (let i = 0; i < 128; i++) {
    const f = {
      id: String(i).padStart(64, "界"),
      name: "界".repeat(160),
      location: "界".repeat(160),
      mode: "界".repeat(160),
      footprint: 1,
      universe: 1,
      start: i + 1,
    };
    p.baseline.push(f);
    p.desired.push(want(f, true));
    p.reservations.push({
      universe: 2,
      start: i + 1,
      end: i + 1,
      purpose: "界".repeat(160),
    });
  }
  const r = solve(p, { maxMs: 0 });
  assert.equal(r.status, "minimum_proven");
  for (const text of [manifest(p), manifest(p, r)]) {
    assert.ok(Buffer.byteLength(text) <= 1500000);
    assert.equal(canonicalProject(parseProject(text)), canonicalProject(p));
  }
  assert.ok(
    Buffer.byteLength(manifest(p, r)) > 1000000,
    "Regression must exercise the previous export/import mismatch",
  );
});
