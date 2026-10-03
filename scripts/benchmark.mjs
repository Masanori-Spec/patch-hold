import { solve } from "../src/solver.ts";
import { demo, empty, base, want, random } from "../test/helpers.mjs";
const scenarios = [];
scenarios.push(["worked-mode-expansion", demo()]);
let p = empty();
for (let i = 0; i < 128; i++) {
  const b = base(`F${String(i).padStart(3, "0")}`, i * 4 + 1, 4);
  p.baseline.push(b);
  p.desired.push(want(b, i >= 8));
}
scenarios.push(["128-fixtures-8-movable", p]);
p = empty();
p.universes = [1, 2];
for (let i = 0; i < 120; i++) {
  const b = base(`F${i}`, i * 4 + 1, 4);
  p.baseline.push(b);
  p.desired.push(want(b, true));
}
for (let i = 0; i < 8; i++)
  p.desired.push(want(base(`N${i}`, 1, 32), false, [1, 2]));
scenarios.push(["120-locked-plus-8-new", p]);
p = empty();
p.desired = [want(base("fragment-test", 1, 3))];
for (let i = 3; i <= 512; i += 3)
  p.reservations.push({ universe: 1, start: i, end: i, purpose: "fragment" });
p.reservations = p.reservations.slice(0, 127);
p.reservations.push({
  universe: 1,
  start: 382,
  end: 512,
  purpose: "closed tail",
});
scenarios.push(["fragmented-no-3-channel-gap", p]);
for (let k = 0; k < 8; k++) {
  p = empty();
  p.universes = [1, 2];
  const rng = random(4200 + k);
  for (let i = 0; i < 8; i++) {
    const b = base(`M${i}`, i * 16 + 1, 8);
    p.baseline.push(b);
    const f = want(b, false, k % 2 ? [1] : [1, 2]);
    f.footprint = 16 + Math.floor(rng() * 16);
    f.mode = `${f.footprint}ch`;
    p.desired.push(f);
  }
  for (let i = 0; i < 8; i++) {
    const b = base(`N${i}`, 1, 12 + Math.floor(rng() * 20));
    p.desired.push(want(b, false, k % 2 ? [1] : [1, 2]));
  }
  for (const u of p.universes)
    p.reservations.push({
      universe: u,
      start: k % 2 ? 301 : 201,
      end: 512,
      purpose: "bounded rig area",
    });
  scenarios.push([`dense-16-search-items-seed-${4200 + k}`, p]);
}
const results = scenarios.map(([scenario, project]) => {
  const r = solve(project);
  return {
    scenario,
    status: r.status,
    addressChanges: r.addressChanges,
    nodes: r.nodes,
    work: r.work,
    elapsedMs: r.elapsedMs,
    reason: r.reason,
  };
});
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      platform: process.platform,
      scope:
        "Synthetic local Node measurements only; not browser or physical-hardware validation",
      budget: { maxNodes: 50000, maxWork: 1000000, maxMs: 5000 },
      scenarios: results.length,
      completed: results.filter((r) =>
        ["minimum_proven", "no_solution_proven"].includes(r.status),
      ).length,
      incomplete: results.filter((r) =>
        ["feasible_incomplete", "budget_exhausted"].includes(r.status),
      ).length,
      results,
    },
    null,
    2,
  ),
);
