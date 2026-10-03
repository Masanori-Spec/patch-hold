import { DEFAULT_BUDGET, LIMITS } from "./model.ts";
import type {
  Project,
  PlanResult,
  Budget,
  Assignment,
  DesiredFixture,
} from "./model.ts";
import {
  validateProject,
  validateAssignment,
  canonicalProject,
  InputError,
} from "./validation.ts";
interface Candidate {
  universe: number;
  start: number;
  mask: bigint;
  cost: number;
}
interface Item {
  f: DesiredFixture;
  candidates: Candidate[];
}
export interface SearchOptions extends Partial<Budget> {
  shouldCancel?: () => boolean;
  now?: () => number;
}
/** Deterministic node/work accounting. A wall-clock cutoff may finish at a different node across machines. */
export function solve(input: unknown, options: SearchOptions = {}): PlanResult {
  const now = options.now ?? (() => performance.now()),
    began = now();
  const budget: Budget = {
    maxNodes:
      options.maxNodes === undefined
        ? DEFAULT_BUDGET.maxNodes
        : options.maxNodes,
    maxWork:
      options.maxWork === undefined ? DEFAULT_BUDGET.maxWork : options.maxWork,
    maxMs: options.maxMs === undefined ? DEFAULT_BUDGET.maxMs : options.maxMs,
  };
  let nodes = 0,
    work = 0,
    halted = false,
    cancelled = false,
    reason = "",
    best: Assignment[] | null = null,
    bestCost = Infinity,
    project: Project;
  const result = (
    status: PlanResult["status"],
    errors: string[] = [],
  ): PlanResult => ({
    schemaVersion: 1,
    engineVersion: "0.1.0",
    status,
    assignment: best,
    addressChanges: best === null ? null : bestCost,
    nodes,
    work,
    elapsedMs: Math.max(0, Math.round((now() - began) * 100) / 100),
    reason,
    errors,
    budget,
    input: project ? canonicalProject(project) : "",
  });
  if (
    !Number.isSafeInteger(budget.maxNodes) ||
    budget.maxNodes < 1 ||
    budget.maxNodes > LIMITS.maxNodes ||
    !Number.isSafeInteger(budget.maxWork) ||
    budget.maxWork < 1 ||
    budget.maxWork > LIMITS.maxWork ||
    !Number.isSafeInteger(budget.maxMs) ||
    budget.maxMs < 0 ||
    budget.maxMs > LIMITS.maxMs
  )
    return result("invalid_input", ["Budget outside supported limits"]);
  try {
    project = validateProject(input);
  } catch (e) {
    return result(
      "invalid_input",
      e instanceof InputError ? e.issues : ["Invalid project"],
    );
  }
  function tick(count = 1): boolean {
    if (halted) return false;
    if (options.shouldCancel?.()) {
      halted = true;
      cancelled = true;
      reason = "cancelled";
      return false;
    }
    if (work + count > budget.maxWork) {
      halted = true;
      reason = "work_budget";
      return false;
    }
    if (budget.maxMs > 0 && now() - began >= budget.maxMs) {
      halted = true;
      reason = "time_budget";
      return false;
    }
    work += count;
    return true;
  }
  const occupied = new Map(project.universes.map((u) => [u, 0n]));
  const mask = (start: number, size: number) =>
    ((1n << BigInt(size)) - 1n) << BigInt(start - 1);
  for (const r of project.reservations)
    occupied.set(
      r.universe,
      occupied.get(r.universe)! | mask(r.start, r.end - r.start + 1),
    );
  const baseline = new Map(project.baseline.map((f) => [f.id, f])),
    fixed: Assignment[] = [],
    items: Item[] = [];
  for (const f of project.desired) {
    if (!tick()) break;
    const old = baseline.get(f.id);
    if (f.locked) {
      if (
        !old ||
        !f.allowedUniverses.includes(old.universe) ||
        old.start + f.footprint - 1 > 512
      ) {
        reason = "locked_fixture_has_no_legal_range";
        return result("no_solution_proven");
      }
      const bits = mask(old.start, f.footprint);
      if (occupied.get(old.universe)! & bits) {
        reason = "locked_fixture_collision";
        return result("no_solution_proven");
      }
      occupied.set(old.universe, occupied.get(old.universe)! | bits);
      fixed.push({ id: f.id, universe: old.universe, start: old.start });
    } else items.push({ f, candidates: [] });
  }
  // Precompute all legal contiguous placements against fixed ranges; no heuristic domain truncation.
  for (const item of items) {
    if (halted) break;
    const old = baseline.get(item.f.id);
    outer: for (const universe of item.f.allowedUniverses)
      for (let start = 1; start + item.f.footprint - 1 <= 512; start++) {
        if (!tick()) break outer;
        const bits = mask(start, item.f.footprint);
        if (!(occupied.get(universe)! & bits))
          item.candidates.push({
            universe,
            start,
            mask: bits,
            cost:
              old && (old.universe !== universe || old.start !== start) ? 1 : 0,
          });
      }
    item.candidates.sort(
      (a, b) => a.cost - b.cost || a.universe - b.universe || a.start - b.start,
    );
    if (!halted && !item.candidates.length) {
      reason = "fixture_has_no_legal_range";
      return result("no_solution_proven");
    }
  }
  const chosen: Assignment[] = [...fixed];
  function visit(todo: Item[], cost: number): void {
    if (halted || bestCost === 0) return;
    if (nodes >= budget.maxNodes) {
      halted = true;
      reason = "node_budget";
      return;
    }
    if (!tick()) return;
    nodes++;
    if (cost >= bestCost) return;
    if (!todo.length) {
      best = chosen
        .map((a) => ({ ...a }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      bestCost = cost;
      return;
    }
    let selected: Item | undefined,
      choices: Candidate[] = [],
      lowerBound = 0;
    for (const item of todo) {
      const available: Candidate[] = [];
      let minCost = Infinity;
      for (const c of item.candidates) {
        if (!tick()) return;
        if (!(occupied.get(c.universe)! & c.mask)) {
          available.push(c);
          minCost = Math.min(minCost, c.cost);
        }
      }
      if (!available.length) return;
      lowerBound += minCost;
      if (
        !selected ||
        available.length < choices.length ||
        (available.length === choices.length &&
          (item.f.footprint > selected.f.footprint ||
            (item.f.footprint === selected.f.footprint &&
              item.f.id < selected.f.id)))
      ) {
        selected = item;
        choices = available;
      }
    }
    if (cost + lowerBound >= bestCost) return;
    const next = todo.filter((i) => i !== selected);
    for (const c of choices) {
      if (cost + c.cost >= bestCost) continue;
      occupied.set(c.universe, occupied.get(c.universe)! | c.mask);
      chosen.push({ id: selected!.f.id, universe: c.universe, start: c.start });
      visit(next, cost + c.cost);
      chosen.pop();
      occupied.set(c.universe, occupied.get(c.universe)! ^ c.mask);
      if (halted || bestCost === 0) return;
    }
  }
  if (!halted) visit(items, 0);
  if (best) {
    const errors = validateAssignment(project, best, bestCost);
    if (errors.length)
      throw new Error(`Internal solver invariant failed: ${errors.join("; ")}`);
  }
  if (cancelled) {
    best = null;
    return result("cancelled");
  }
  if (bestCost === 0) {
    reason = "global_zero_lower_bound";
    return result("minimum_proven");
  }
  if (halted) return result(best ? "feasible_incomplete" : "budget_exhausted");
  reason = "exhaustive_search";
  return result(best ? "minimum_proven" : "no_solution_proven");
}
