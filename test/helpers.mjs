import { readFileSync } from "node:fs";
export const demo = () =>
  JSON.parse(
    readFileSync(new URL("../examples/worked.json", import.meta.url), "utf8"),
  );
export const empty = () => ({
  schemaVersion: 1,
  title: "Synthetic test",
  universes: [1],
  baseline: [],
  desired: [],
  reservations: [],
});
export const base = (id, start = 1, footprint = 1, universe = 1) => ({
  id,
  name: id,
  location: "",
  mode: `${footprint}ch`,
  footprint,
  universe,
  start,
});
export const want = (b, locked = false, universes = [b.universe]) => ({
  id: b.id,
  name: b.name,
  location: b.location,
  mode: b.mode,
  footprint: b.footprint,
  locked,
  allowedUniverses: universes,
});
export function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function cases(count, seed = 20261003) {
  const rng = random(seed),
    pick = (n) => Math.floor(rng() * n),
    all = [];
  for (let k = 0; k < count; k++) {
    const p = empty();
    p.universes = [1, 2];
    const cap = 5;
    for (const u of p.universes)
      p.reservations.push({
        universe: u,
        start: cap + 1,
        end: 512,
        purpose: "reduced capacity",
      });
    const occ = [new Set(), new Set()];
    for (let i = 0, n = 1 + pick(4); i < n; i++) {
      const u = pick(2),
        size = 1 + pick(2);
      let start = 1 + pick(cap - size + 1),
        available = true;
      for (let c = start; c < start + size; c++)
        if (occ[u].has(c)) available = false;
      if (!available) continue;
      for (let c = start; c < start + size; c++) occ[u].add(c);
      const b = base(`B${i}`, start, size, u + 1);
      p.baseline.push(b);
      if (rng() < 0.12) continue;
      const d = want(b, rng() < 0.3, rng() < 0.5 ? [1, 2] : [1 + pick(2)]);
      d.footprint = 1 + pick(4);
      d.mode = `${d.footprint}ch`;
      p.desired.push(d);
    }
    if (rng() < 0.65 && p.desired.length < 4) {
      const d = want(
        base("new", 1, 1 + pick(4)),
        false,
        rng() < 0.5 ? [1, 2] : [1 + pick(2)],
      );
      p.desired.push(d);
    }
    if (rng() < 0.3)
      p.reservations.push({
        universe: 1 + pick(2),
        start: 1 + pick(cap),
        end: cap,
        purpose: "extra restriction",
      });
    all.push(p);
  }
  return all;
}
/** Independent exhaustive placement oracle, with explicit occupied cells and no objective pruning, bitsets or MRV. */
export function oracle(p) {
  const old = new Map(p.baseline.map((b) => [b.id, b])),
    blocked = new Set();
  for (const r of p.reservations)
    for (let c = r.start; c <= r.end; c++) blocked.add(`${r.universe}:${c}`);
  const domains = p.desired.map((f) => {
    const list = [],
      b = old.get(f.id);
    for (const u of f.allowedUniverses)
      for (let s = 1; s + f.footprint - 1 <= 512; s++) {
        if (f.locked && (!b || b.universe !== u || b.start !== s)) continue;
        const cells = [];
        let free = true;
        for (let c = s; c < s + f.footprint; c++) {
          const key = `${u}:${c}`;
          cells.push(key);
          if (blocked.has(key)) free = false;
        }
        if (free) list.push({ u, s, cells });
      }
    return list;
  });
  let optimum = null;
  function enumerate(i, used, cost) {
    if (i === p.desired.length) {
      optimum = optimum === null ? cost : Math.min(optimum, cost);
      return;
    }
    const f = p.desired[i],
      b = old.get(f.id);
    for (const pos of domains[i]) {
      if (pos.cells.some((c) => used.has(c))) continue;
      enumerate(
        i + 1,
        new Set([...used, ...pos.cells]),
        cost + (b && (b.universe !== pos.u || b.start !== pos.s) ? 1 : 0),
      );
    }
  }
  enumerate(0, new Set(blocked), 0);
  return optimum;
}
