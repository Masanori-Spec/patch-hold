import test from "node:test";
import assert from "node:assert/strict";
import { solve } from "../src/solver.ts";
import {
  validateProject,
  validateAssignment,
  validateCertificate,
  parseProject,
  canonicalProject,
} from "../src/validation.ts";
import { demo, empty, base, want, cases, oracle } from "./helpers.mjs";
const full = { maxMs: 0, maxWork: 5000000, maxNodes: 200000 };
test("worked mode expansion proves exactly one address change", () => {
  const p = demo(),
    r = solve(p, full);
  assert.equal(r.status, "minimum_proven");
  assert.equal(r.addressChanges, 1);
  assert.deepEqual(r.assignment, [
    { id: "A", universe: 1, start: 1 },
    { id: "B", universe: 1, start: 7 },
    { id: "C", universe: 1, start: 12 },
    { id: "D", universe: 1, start: 11 },
  ]);
  assert.deepEqual(validateCertificate(p, r), []);
});
test("1,200 seeded cases match an independent exhaustive cell-set oracle", () => {
  for (const [i, p] of cases(1200).entries()) {
    const expected = oracle(p),
      r = solve(p, full);
    assert.equal(
      r.status,
      expected === null ? "no_solution_proven" : "minimum_proven",
      `case ${i}`,
    );
    assert.equal(r.addressChanges, expected, `case ${i}`);
    if (r.assignment)
      assert.deepEqual(
        validateAssignment(p, r.assignment, r.addressChanges),
        [],
      );
  }
});
test("integer ranges, exact-fit 512 and non-contiguous universes", () => {
  const p = empty();
  p.universes = [2, 9];
  p.baseline = [base("full", 1, 512, 2), base("last", 512, 1, 9)];
  p.desired = p.baseline.map((b) => want(b, true));
  const r = solve(p, full);
  assert.equal(r.status, "minimum_proven");
  assert.equal(r.addressChanges, 0);
  p.desired[1].footprint = 2;
  assert.equal(solve(p, full).status, "no_solution_proven");
});
test("invalid numeric values and cross-universe baseline ranges rejected", () => {
  for (const field of ["start", "footprint", "universe"])
    for (const value of [0, -1, NaN, Infinity, 1.2, "1", null]) {
      const p = empty(),
        b = base("x");
      b[field] = value;
      p.baseline = [b];
      assert.equal(solve(p).status, "invalid_input", `${field}=${value}`);
    }
  const p = empty();
  p.baseline = [base("x", 512, 2)];
  assert.throws(() => validateProject(p));
});
test("bad baseline rejected, conflicting desired sizes remain a solvable problem", () => {
  const p = demo();
  p.baseline[1].start = 4;
  assert.equal(solve(p).status, "invalid_input");
  p.baseline[1].start = 5;
  assert.equal(solve(p).status, "minimum_proven");
  p.desired[0].locked = p.desired[1].locked = true;
  assert.equal(solve(p).status, "no_solution_proven");
});
test("lock restrictions and desired-only reservations", () => {
  const p = empty(),
    b = base("x", 1, 2);
  p.baseline = [b];
  p.desired = [want(b)];
  p.reservations = [
    { universe: 1, start: 1, end: 2, purpose: "reserved after change" },
  ];
  assert.equal(solve(p, full).addressChanges, 1);
  p.desired[0].locked = true;
  assert.equal(solve(p, full).status, "no_solution_proven");
  p.universes = [1, 2];
  p.reservations = [];
  p.desired[0].allowedUniverses = [2];
  assert.equal(solve(p, full).status, "no_solution_proven");
  p.desired[0].locked = false;
  assert.equal(solve(p, full).assignment[0].universe, 2);
});
test("fragmentation is not total-free-channel feasibility", () => {
  const p = empty();
  p.desired = [want(base("x", 1, 3))];
  p.reservations = [
    { universe: 1, start: 3, end: 3, purpose: "" },
    { universe: 1, start: 6, end: 512, purpose: "" },
  ];
  assert.equal(solve(p, full).status, "no_solution_proven");
});
test("new, removed and empty targets supported", () => {
  const p = empty();
  p.baseline = [base("removed")];
  assert.deepEqual(solve(p, full).assignment, []);
  p.desired = [want(base("new", 1, 512))];
  const r = solve(p, full);
  assert.equal(r.addressChanges, 0);
  assert.equal(r.assignment[0].start, 1);
});
test("duplicate IDs, undeclared universes, unsupported schema, shared/split fields rejected", () => {
  for (const mutate of [
    (p) => p.baseline.push(p.baseline[0]),
    (p) => p.desired.push(p.desired[0]),
    (p) => (p.desired[0].allowedUniverses = [2]),
    (p) => (p.desired[0].allowedUniverses = [1, 1]),
    (p) => (p.schemaVersion = 2),
    (p) => (p.desired[0].breaks = [1, 2]),
    (p) => (p.sharedAddress = true),
    (p) => (p.desired[0].footprint = 0),
    (p) => (p.reservations[0].end = 0),
    (p) => (p.desired[0].name = "a\u0000b"),
  ]) {
    const p = demo();
    mutate(p);
    assert.equal(solve(p).status, "invalid_input");
  }
});
test("resource caps and oversized input rejected before search", () => {
  assert.throws(() => parseProject(" ".repeat(1500001)));
  for (const n of [9, 129]) {
    const p = empty();
    for (let i = 0; i < n; i++) p.desired.push(want(base(`x${i}`)));
    assert.equal(solve(p).status, "invalid_input");
  }
  const p = empty();
  p.universes = [1, 2, 3, 4, 5];
  assert.equal(solve(p).status, "invalid_input");
  for (const v of [-1, 0, 200001, NaN])
    assert.equal(solve(demo(), { maxNodes: v }).status, "invalid_input");
});
test("work/node budgets never claim no solution or minimum without evidence", () => {
  const p = demo();
  for (const options of [{ maxWork: 1 }, { maxNodes: 1 }]) {
    const r = solve(p, { ...full, ...options });
    assert.equal(r.status, "budget_exhausted");
    assert.equal(r.assignment, null);
    assert.ok(r.nodes <= r.budget.maxNodes && r.work <= r.budget.maxWork);
  }
  let clock = 0;
  const r = solve(p, { maxMs: 1, now: () => clock++ });
  assert.equal(r.status, "budget_exhausted");
  assert.equal(r.reason, "time_budget");
});
test("feasible incumbent under interruption is explicitly incomplete", () => {
  let found = false;
  for (const p of cases(200, 7331)) {
    const all = solve(p, full);
    if (
      all.addressChanges > 0 &&
      all.nodes > p.desired.filter((f) => !f.locked).length + 1
    ) {
      for (let n = 1; n < all.nodes; n++) {
        const r = solve(p, { ...full, maxNodes: n });
        if (r.status === "feasible_incomplete") {
          assert.ok(r.addressChanges >= all.addressChanges);
          assert.deepEqual(
            validateAssignment(p, r.assignment, r.addressChanges),
            [],
          );
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }
  assert.equal(
    found,
    true,
    "The test must exercise a real incumbent at cutoff",
  );
});
test("cancellation drops any incomplete assignment; deterministic work and stable row-independent tie order", () => {
  let calls = 0;
  assert.equal(
    solve(demo(), { ...full, shouldCancel: () => ++calls > 10 }).status,
    "cancelled",
  );
  const p = demo(),
    before = JSON.stringify(p),
    a = solve(p, full),
    b = solve(p, full);
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(a.assignment, b.assignment);
  assert.equal(a.nodes, b.nodes);
  assert.equal(a.work, b.work);
  p.baseline.reverse();
  p.desired.reverse();
  p.reservations.reverse();
  assert.equal(canonicalProject(p), a.input);
  assert.deepEqual(solve(p, full).assignment, a.assignment);
  for (const r of [
    solve(p, { ...full, maxWork: 1200 }),
    solve(p, { ...full, maxWork: 1200 }),
  ])
    assert.equal(r.work, 1200);
});
test("independent validator rejects collision, moved lock, missing ID, wrong cost and stale certificate", () => {
  const p = demo(),
    r = solve(p, full);
  for (const change of [
    (a) => (a[1].start = 1),
    (a) => (a[2].start = 13),
    (a) => a.pop(),
    (a) => (a[0].id = "missing"),
    (a) => (a[0].start = 512),
  ]) {
    const a = structuredClone(r.assignment);
    change(a);
    assert.ok(validateAssignment(p, a, r.addressChanges).length);
  }
  assert.ok(validateAssignment(p, r.assignment, 0).length);
  p.title = "new title";
  assert.ok(validateCertificate(p, r).length);
});
test("prototype-shaped IDs are inert data", () => {
  const p = empty();
  p.desired = [want(base("__proto__"))];
  const r = solve(p, full);
  assert.equal(r.status, "minimum_proven");
  assert.deepEqual(validateAssignment(p, r.assignment, 0), []);
  assert.throws(() =>
    parseProject(
      '{"schemaVersion":1,"__proto__":{},"title":"x","universes":[1],"baseline":[],"desired":[],"reservations":[]}',
    ),
  );
});
