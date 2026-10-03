import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { solve } from "../src/solver.ts";
import { LIMITS } from "../src/model.ts";
import {
  validateProject,
  validateAssignment,
  parseProject,
  validateCertificate,
} from "../src/validation.ts";
import {
  changeRows,
  changesCsv,
  patchCsv,
  addressCards,
  manifest,
} from "../src/exports.ts";

const fullBudget = { maxNodes: 200_000, maxWork: 5_000_000, maxMs: 0 };
const fixture = (id, extra = {}) => ({
  id,
  name: id,
  location: "",
  mode: "one",
  footprint: 1,
  ...extra,
});
const project = (extra = {}) => ({
  schemaVersion: 1,
  title: "Independent review",
  universes: [1],
  baseline: [],
  desired: [],
  reservations: [],
  ...extra,
});
const wanted = (id, extra = {}) =>
  fixture(id, { locked: false, allowedUniverses: [1], ...extra });

// This oracle enumerates the Cartesian product in input order and examines each
// complete tuple with ordinary cell sets. It has no MRV, bitsets, pruning,
// candidate precomputation, or imported feasibility/objective implementation.
function brute(p, window) {
  const domains = p.desired.map((f) => {
    const b = p.baseline.find((x) => x.id === f.id);
    if (f.locked)
      return b ? [{ id: f.id, universe: b.universe, start: b.start }] : [];
    return f.allowedUniverses.flatMap((universe) =>
      Array.from({ length: window }, (_, i) => ({
        id: f.id,
        universe,
        start: i + 1,
      })),
    );
  });
  let optimum = Infinity;
  function complete(tuple) {
    const cells = new Set();
    for (const r of p.reservations)
      for (let x = r.start; x <= r.end; x++) cells.add(`${r.universe}/${x}`);
    let cost = 0;
    for (let i = 0; i < tuple.length; i++) {
      const a = tuple[i],
        f = p.desired[i],
        b = p.baseline.find((x) => x.id === f.id);
      if (
        !f.allowedUniverses.includes(a.universe) ||
        a.start < 1 ||
        a.start + f.footprint - 1 > 512
      )
        return;
      for (let x = a.start; x < a.start + f.footprint; x++) {
        const key = `${a.universe}/${x}`;
        if (cells.has(key)) return;
        cells.add(key);
      }
      if (b && (b.universe !== a.universe || b.start !== a.start)) cost++;
    }
    optimum = Math.min(optimum, cost);
  }
  function expand(index, tuple) {
    if (index === domains.length) return complete(tuple);
    for (const a of domains[index]) expand(index + 1, [...tuple, a]);
  }
  expand(0, []);
  return optimum;
}

test("independent complete-tuple oracle: exhaustive 1,944 small two-universe model combinations", () => {
  let count = 0;
  const allowed = [[1], [2], [1, 2]];
  for (const fa of [1, 2, 3])
    for (const fb of [1, 2, 3])
      for (const la of [false, true])
        for (const lb of [false, true])
          for (const ua of allowed)
            for (const ub of allowed)
              for (const added of [0, 1, 2])
                for (const reserveMiddle of [false, true]) {
                  const p = project({
                    universes: [1, 2],
                    baseline: [
                      fixture("A", { universe: 1, start: 1 }),
                      fixture("B", { universe: 1, start: 3 }),
                    ],
                    desired: [
                      wanted("A", {
                        footprint: fa,
                        locked: la,
                        allowedUniverses: ua,
                      }),
                      wanted("B", {
                        footprint: fb,
                        locked: lb,
                        allowedUniverses: ub,
                      }),
                      ...(added
                        ? [
                            wanted("C", {
                              footprint: added,
                              allowedUniverses: [1, 2],
                            }),
                          ]
                        : []),
                    ],
                    reservations: [
                      { universe: 1, start: 4, end: 512, purpose: "bound" },
                      { universe: 2, start: 4, end: 512, purpose: "bound" },
                      ...(reserveMiddle
                        ? [{ universe: 2, start: 2, end: 2, purpose: "hole" }]
                        : []),
                    ],
                  });
                  const expected = brute(p, 3),
                    actual = solve(p, fullBudget);
                  count++;
                  assert.equal(
                    actual.status,
                    expected === Infinity
                      ? "no_solution_proven"
                      : "minimum_proven",
                    JSON.stringify({ p, expected, actual }),
                  );
                  assert.equal(
                    actual.addressChanges,
                    expected === Infinity ? null : expected,
                  );
                  if (actual.assignment)
                    assert.deepEqual(
                      validateAssignment(
                        p,
                        actual.assignment,
                        actual.addressChanges,
                      ),
                      [],
                    );
                }
  assert.equal(count, 1944);
});

test("objective excludes additions, removals and mode-only changes, but checklist retains mode work", () => {
  const p = project({
    baseline: [
      fixture("A", { universe: 1, start: 1 }),
      fixture("gone", { universe: 1, start: 9 }),
    ],
    desired: [
      wanted("A", { mode: "expanded", footprint: 3, locked: true }),
      wanted("new"),
    ],
  });
  const r = solve(p, fullBudget);
  assert.equal(r.status, "minimum_proven");
  assert.equal(r.addressChanges, 0);
  const rows = changeRows(p, r);
  assert.equal(rows.find((x) => x.id === "A").action, "mode/footprint");
  assert.match(rows.find((x) => x.id === "A").checklist, /mode\/footprint/);
  assert.equal(rows.find((x) => x.id === "gone").action, "removed");
  assert.equal(rows.find((x) => x.id === "new").action, "new");
  assert.match(changesCsv(p, r), /mode\/footprint/);
  assert.match(changesCsv(p, r), /removed/);
});

test("boundary and labels: channel 512 is legal, a 513th channel and forbidden universes are infeasible", () => {
  const p = project({
    universes: [9999],
    baseline: [fixture("A", { universe: 9999, start: 512 })],
    desired: [wanted("A", { allowedUniverses: [9999], locked: true })],
  });
  assert.equal(solve(p, fullBudget).status, "minimum_proven");
  p.desired[0].footprint = 2;
  assert.equal(solve(p, fullBudget).status, "no_solution_proven");
  p.desired[0].footprint = 1;
  p.universes.push(1);
  p.desired[0].allowedUniverses = [1];
  assert.equal(solve(p, fullBudget).status, "no_solution_proven");
});

test("a reservation may force movement from baseline; overlapping reservations have union semantics", () => {
  const p = project({
    baseline: [fixture("A", { universe: 1, start: 1 })],
    desired: [wanted("A")],
    reservations: [
      { universe: 1, start: 1, end: 2, purpose: "one" },
      { universe: 1, start: 2, end: 3, purpose: "two" },
    ],
  });
  const r = solve(p, fullBudget);
  assert.equal(r.status, "minimum_proven");
  assert.equal(r.addressChanges, 1);
  assert.equal(r.assignment[0].start, 4);
});

test("node and work cutoffs do not invent infeasibility or claim minimum", () => {
  const p = project({
    baseline: [
      fixture("A", { universe: 1, start: 1 }),
      fixture("B", { universe: 1, start: 3 }),
      fixture("C", { universe: 1, start: 5 }),
    ],
    desired: [
      wanted("A", { footprint: 3 }),
      wanted("B", { footprint: 3 }),
      wanted("C"),
    ],
    reservations: [{ universe: 1, start: 8, end: 512, purpose: "bound" }],
  });
  const low = solve(p, { ...fullBudget, maxWork: 1 });
  assert.equal(low.status, "budget_exhausted");
  assert.equal(low.assignment, null);
  const one = solve(p, { ...fullBudget, maxNodes: 1 });
  assert.equal(one.status, "budget_exhausted");
  assert.equal(one.reason, "node_budget");
  const statuses = new Set();
  for (let n = 2; n < 30; n++) {
    const r = solve(p, { ...fullBudget, maxNodes: n });
    statuses.add(r.status);
    if (r.status === "feasible_incomplete")
      assert.deepEqual(
        validateAssignment(p, r.assignment, r.addressChanges),
        [],
      );
    if (r.status === "minimum_proven") assert.equal(r.addressChanges, 2);
  }
  assert.ok(statuses.has("feasible_incomplete"));
  assert.ok(statuses.has("minimum_proven"));
  const incumbent = solve(p, { ...fullBudget, maxNodes: 4 });
  assert.equal(incumbent.status, "feasible_incomplete");
  let checks = 0;
  const cancelled = solve(p, {
    ...fullBudget,
    shouldCancel: () => ++checks > incumbent.work + 1,
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.assignment, null);
  assert.equal(cancelled.addressChanges, null);
});

test("time cutoff and cancellation are distinct; cancellation discards any intermediate plan", () => {
  const p = project({ desired: [wanted("A")] });
  let clock = 0;
  assert.equal(
    solve(p, { ...fullBudget, maxMs: 1, now: () => ++clock }).status,
    "budget_exhausted",
  );
  let calls = 0;
  const r = solve(p, { ...fullBudget, shouldCancel: () => ++calls > 100 });
  assert.equal(r.status, "cancelled");
  assert.equal(r.assignment, null);
  assert.equal(r.addressChanges, null);
  assert.equal(solve(p, fullBudget).status, "minimum_proven");
});

test("strict numeric validation rejects coercible, unsafe, nonfinite and fractional input", () => {
  for (const invalid of [
    "1",
    null,
    true,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      solve(project({ desired: [wanted("A", { footprint: invalid })] })).status,
      "invalid_input",
    );
    assert.equal(
      solve(project({ universes: [invalid] })).status,
      "invalid_input",
    );
    assert.equal(
      solve(project(), { maxNodes: invalid }).status,
      "invalid_input",
    );
  }
});

test("rejects sparse universe/domain arrays rather than accepting undefined or crashing", () => {
  for (const sparse of [Array(1), [1, ...Array(1)]]) {
    assert.throws(() => validateProject(project({ universes: sparse })));
    assert.equal(solve(project({ universes: sparse })).status, "invalid_input");
  }
  const p = project({ desired: [wanted("A", { allowedUniverses: Array(1) })] });
  assert.throws(() => validateProject(p));
  assert.equal(solve(p).status, "invalid_input");
});

test("oversized universe arrays are rejected without scanning their whole sparse length", () => {
  let probes = 0;
  const universes = new Proxy(Array(256), {
    has(target, key) {
      if (/^\d+$/.test(String(key))) probes++;
      return Reflect.has(target, key);
    },
  });
  assert.throws(() => validateProject(project({ universes })));
  assert.ok(
    probes <= 4,
    `probed ${probes} indices despite a four-universe limit`,
  );
});

test("prototype-looking IDs are safe keys; extra prototype fields and class-shaped objects are rejected", () => {
  for (const id of ["__proto__", "constructor", "toString"]) {
    const p = project({ desired: [wanted(id)] });
    const r = solve(p, fullBudget);
    assert.equal(r.status, "minimum_proven");
    assert.equal(r.assignment[0].id, id);
  }
  assert.throws(() =>
    parseProject(
      '{"schemaVersion":1,"title":"x","universes":[1],"baseline":[],"desired":[],"reservations":[],"__proto__":{}}',
    ),
  );
  assert.throws(() =>
    validateProject(Object.assign(Object.create({}), project())),
  );
});

test("input limits bound entries, individual strings, total bytes, and distinct fixture identities", () => {
  assert.throws(() => parseProject(" ".repeat(LIMITS.jsonBytes + 1)));
  assert.equal(
    solve(project({ title: "x".repeat(161) })).status,
    "invalid_input",
  );
  assert.equal(
    solve(
      project({
        desired: Array.from({ length: 9 }, (_, i) => wanted(String(i))),
      }),
    ).status,
    "invalid_input",
  );
  assert.equal(
    solve(
      project({
        reservations: Array.from({ length: 129 }, () => ({
          universe: 1,
          start: 1,
          end: 1,
          purpose: "",
        })),
      }),
    ).status,
    "invalid_input",
  );
  assert.equal(
    solve(project({ universes: [1, 2, 3, 4, 5] })).status,
    "invalid_input",
  );
});

test("manifest import ignores fabricated result status and stale inputs cannot export", () => {
  const p = project({ desired: [wanted("A")] });
  const r = solve(p, fullBudget);
  const saved = JSON.parse(manifest(p, r));
  saved.result.status = "minimum_proven";
  saved.result.assignment = [{ id: "A", universe: 1, start: 999 }];
  assert.deepEqual(parseProject(JSON.stringify(saved)), validateProject(p));
  const changed = structuredClone(p);
  changed.desired[0].footprint = 2;
  assert.notDeepEqual(validateCertificate(changed, r), []);
  assert.throws(() => patchCsv(changed, r));
  assert.throws(() =>
    addressCards(p, {
      ...r,
      assignment: [{ id: "A", universe: 1, start: 513 }],
    }),
  );
});

test("CSV formula defenses and HTML escaping preserve hostile labels as inert text", () => {
  const p = project({
    title: "<script>alert(1)</script>",
    desired: [
      wanted("=SUM(A1:A2)", {
        name: "\t=cmd|1",
        location: "<img src=x onerror=alert(1)>",
        mode: '"&<svg/onload=1>',
      }),
    ],
  });
  const r = solve(p, fullBudget),
    csv = patchCsv(p, r),
    html = addressCards(p, r);
  assert.ok(csv.includes('"\'=SUM(A1:A2)"'));
  assert.ok(csv.includes('"\'\t=cmd|1"'));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x"));
});

const cli = (args, opts = {}) =>
  spawnSync(process.execPath, ["src/cli.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    timeout: 3000,
    ...opts,
  });
test("CLI refuses existing output directory without overwriting user files and bounds input bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "patchhold-review-"));
  try {
    const input = join(dir, "input.json"),
      out = join(dir, "out");
    await writeFile(input, JSON.stringify(project()));
    await mkdir(out);
    await writeFile(join(out, "patch.csv"), "DO NOT OVERWRITE");
    const r = cli([input, "--out", out]);
    assert.equal(r.status, 5);
    assert.equal(
      await readFile(join(out, "patch.csv"), "utf8"),
      "DO NOT OVERWRITE",
    );
    const giant = join(dir, "large.json");
    await writeFile(giant, " ".repeat(LIMITS.jsonBytes + 1));
    assert.equal(cli([giant]).status, 5);
    assert.equal(cli([input, "--nodes", "Infinity"]).status, 5);
    assert.equal(cli([input, "--work", "1", "--work", "2"]).status, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "CLI rejects FIFO input promptly instead of blocking in open()",
  { skip: process.platform === "win32" },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "patchhold-review-fifo-"));
    try {
      const fifo = join(dir, "input.json");
      const make = spawnSync("mkfifo", [fifo]);
      assert.equal(make.status, 0);
      const r = cli([fifo], { timeout: 1500 });
      assert.ok(!r.error, `CLI blocked on FIFO: ${r.error?.code}`);
      assert.equal(r.status, 5);
      assert.match(r.stderr, /regular/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
