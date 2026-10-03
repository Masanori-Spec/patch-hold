import { LIMITS } from "./model.ts";
import type { Project, Assignment, PlanResult } from "./model.ts";
export class InputError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "InputError";
    this.issues = issues;
  }
}
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);
const integer = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= lo && v <= hi;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).length > LIMITS.jsonBytes)
    throw new InputError(["JSON exceeds 1,500,000 bytes"]);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InputError(["Invalid JSON"]);
  }
  if (plain(data) && data.kind === "patchhold-manifest") {
    if (data.schemaVersion !== 1)
      throw new InputError(["Unsupported manifest version"]);
    data = data.project; // Saved results are deliberately not trusted or restored.
  }
  return validateProject(data);
}
export function validateProject(value: unknown): Project {
  const errors: string[] = [];
  const fail = (s: string) => {
    if (errors.length < 40) errors.push(s);
  };
  const keys = (
    o: Record<string, unknown>,
    allowed: string[],
    path: string,
  ) => {
    for (const k of Object.keys(o))
      if (!allowed.includes(k))
        fail(`${path}: unsupported field ${k.slice(0, 80)}`);
  };
  const str = (
    v: unknown,
    path: string,
    max: number = LIMITS.text,
    nonempty = false,
  ): v is string => {
    if (
      typeof v !== "string" ||
      v.length > max ||
      (nonempty && !v.trim()) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
    ) {
      fail(`${path}: expected plain text, max ${max} characters`);
      return false;
    }
    return true;
  };
  if (!plain(value)) throw new InputError(["Project must be an object"]);
  keys(
    value,
    [
      "schemaVersion",
      "title",
      "universes",
      "baseline",
      "desired",
      "reservations",
    ],
    "project",
  );
  if (value.schemaVersion !== 1) fail("schemaVersion must be 1");
  str(value.title, "title");
  const us = value.universes;
  if (
    !Array.isArray(us) ||
    us.length < 1 ||
    us.length > LIMITS.universes ||
    [...us].some((u) => !integer(u, 1, 9999)) ||
    new Set(us).size !== us.length
  )
    fail("universes: 1–4 unique logical labels, integers 1–9999");
  const universes: number[] = Array.isArray(us)
    ? us.slice(0, 4).filter((u): u is number => integer(u, 1, 9999))
    : [];
  for (const key of ["baseline", "desired", "reservations"] as const)
    if (
      !Array.isArray(value[key]) ||
      value[key].length >
        LIMITS[key === "reservations" ? "reservations" : "fixtures"]
    )
      fail(`${key}: too many entries or not an array`);
  if (errors.length) throw new InputError(errors);
  const baseline = value.baseline as unknown[],
    desired = value.desired as unknown[],
    reservations = value.reservations as unknown[];
  const baselineIds = new Set<string>(),
    desiredIds = new Set<string>();
  for (const [kind, rows] of [
    ["baseline", baseline],
    ["desired", desired],
  ] as const)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i],
        path = `${kind}[${i}]`;
      if (!plain(row)) {
        fail(`${path}: must be an object`);
        continue;
      }
      keys(
        row,
        [
          "id",
          "name",
          "location",
          "mode",
          "footprint",
          ...(kind === "baseline"
            ? ["universe", "start"]
            : ["locked", "allowedUniverses"]),
        ],
        path,
      );
      str(row.id, `${path}.id`, LIMITS.id, true);
      str(row.name, `${path}.name`);
      str(row.location, `${path}.location`);
      str(row.mode, `${path}.mode`);
      const ids = kind === "baseline" ? baselineIds : desiredIds;
      if (typeof row.id === "string") {
        if (ids.has(row.id)) fail(`${path}: duplicate ID`);
        ids.add(row.id);
      }
      if (!integer(row.footprint, 1, 512))
        fail(`${path}.footprint: integer 1–512 required`);
      if (kind === "baseline") {
        if (!universes.includes(row.universe as number))
          fail(`${path}.universe: not declared`);
        if (
          !integer(row.start, 1, 512) ||
          !integer(row.footprint, 1, 512) ||
          row.start + row.footprint - 1 > 512
        )
          fail(`${path}: baseline range crosses universe boundary`);
      } else {
        if (typeof row.locked !== "boolean")
          fail(`${path}.locked: boolean required`);
        if (
          !Array.isArray(row.allowedUniverses) ||
          !row.allowedUniverses.length ||
          row.allowedUniverses.length > 4 ||
          [...row.allowedUniverses].some(
            (u) => !universes.includes(u as number),
          ) ||
          new Set(row.allowedUniverses).size !== row.allowedUniverses.length
        )
          fail(`${path}.allowedUniverses: unique declared labels required`);
      }
    }
  for (let i = 0; i < reservations.length; i++) {
    const r = reservations[i],
      path = `reservations[${i}]`;
    if (!plain(r)) {
      fail(`${path}: must be an object`);
      continue;
    }
    keys(r, ["universe", "start", "end", "purpose"], path);
    str(r.purpose, `${path}.purpose`);
    if (
      !universes.includes(r.universe as number) ||
      !integer(r.start, 1, 512) ||
      !integer(r.end, 1, 512) ||
      r.end < r.start
    )
      fail(`${path}: invalid inclusive reserved range`);
  }
  if (errors.length) throw new InputError(errors);
  // Copy only declared fields. No prototype merge, user-defined behavior, or stale result reuse.
  const raw = value as unknown as Project;
  const p: Project = {
    schemaVersion: 1,
    title: raw.title,
    universes: [...raw.universes].sort((a, b) => a - b),
    baseline: raw.baseline
      .map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        mode: r.mode,
        footprint: r.footprint,
        universe: r.universe,
        start: r.start,
      }))
      .sort((a, b) => compare(a.id, b.id)),
    desired: raw.desired
      .map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        mode: r.mode,
        footprint: r.footprint,
        locked: r.locked,
        allowedUniverses: [...r.allowedUniverses].sort((a, b) => a - b),
      }))
      .sort((a, b) => compare(a.id, b.id)),
    reservations: raw.reservations
      .map((r) => ({
        universe: r.universe,
        start: r.start,
        end: r.end,
        purpose: r.purpose,
      }))
      .sort(
        (a, b) =>
          a.universe - b.universe ||
          a.start - b.start ||
          a.end - b.end ||
          compare(a.purpose, b.purpose),
      ),
  };
  if (new Set([...baselineIds, ...desiredIds]).size > LIMITS.fixtures)
    fail("At most 128 distinct fixtures across baseline and desired");
  const old = new Map(p.baseline.map((f) => [f.id, f]));
  if (
    p.desired.filter((f) => old.has(f.id) && !f.locked).length > LIMITS.movable
  )
    fail("At most 8 movable existing fixtures");
  if (p.desired.filter((f) => !old.has(f.id)).length > LIMITS.additions)
    fail("At most 8 new fixtures");
  for (const f of p.desired)
    if (f.locked && !old.has(f.id))
      fail(
        `Fixture ${f.id}: a new fixture cannot lock an unknown baseline address`,
      );
  const occupied = new Set<string>();
  for (const f of p.baseline)
    for (let c = f.start; c < f.start + f.footprint; c++) {
      const key = `${f.universe}:${c}`;
      if (occupied.has(key)) {
        fail(`Baseline collision at U${f.universe}:${c}`);
        break;
      }
      occupied.add(key);
    }
  // Reservations constrain the desired plan only; overlap with baseline is valid and may force a move.
  if (errors.length) throw new InputError(errors);
  return p;
}
export const canonicalProject = (p: Project): string =>
  JSON.stringify(validateProject(p));
/** Independent range-cell validator. It shares no solver bitsets or candidate generation. */
export function validateAssignment(
  project: Project,
  assignment: unknown,
  claimedCost?: number | null,
): string[] {
  const errors: string[] = [],
    p = validateProject(project);
  if (!Array.isArray(assignment) || assignment.length !== p.desired.length)
    return ["Assignment must contain every desired fixture exactly once"];
  const desired = new Map(p.desired.map((f) => [f.id, f])),
    old = new Map(p.baseline.map((f) => [f.id, f])),
    seen = new Set<string>(),
    occupied = new Set<string>();
  let cost = 0;
  for (const r of p.reservations)
    for (let c = r.start; c <= r.end; c++) occupied.add(`${r.universe}:${c}`);
  for (const v of assignment) {
    if (
      !plain(v) ||
      typeof v.id !== "string" ||
      !desired.has(v.id) ||
      seen.has(v.id)
    ) {
      errors.push("Unknown, malformed or duplicate assignment ID");
      continue;
    }
    const f = desired.get(v.id)!,
      b = old.get(v.id);
    seen.add(v.id);
    if (
      !integer(v.start, 1, 512) ||
      !integer(v.universe, 1, 9999) ||
      !f.allowedUniverses.includes(v.universe) ||
      v.start + f.footprint - 1 > 512
    ) {
      errors.push(`Invalid range for ${f.id}`);
      continue;
    }
    if (f.locked && (!b || b.universe !== v.universe || b.start !== v.start))
      errors.push(`Lock moved: ${f.id}`);
    if (b && (b.universe !== v.universe || b.start !== v.start)) cost++;
    for (let c = v.start; c < v.start + f.footprint; c++) {
      const key = `${v.universe}:${c}`;
      if (occupied.has(key)) errors.push(`Collision at ${key}`);
      occupied.add(key);
    }
  }
  if (claimedCost !== undefined && claimedCost !== cost)
    errors.push("Address-change count does not match assignment");
  return errors;
}
export function validateCertificate(p: Project, result: PlanResult): string[] {
  const errors: string[] = [];
  if (
    result.schemaVersion !== 1 ||
    result.engineVersion !== "0.1.0" ||
    result.input !== canonicalProject(p)
  )
    errors.push("Result does not belong to this input or engine version");
  if (!["minimum_proven", "feasible_incomplete"].includes(result.status))
    errors.push("Result is not an exportable feasible plan");
  errors.push(
    ...validateAssignment(p, result.assignment, result.addressChanges),
  );
  // This validates feasibility and input binding; minimality requires replaying the solver, not trusting imported status.
  return errors;
}
