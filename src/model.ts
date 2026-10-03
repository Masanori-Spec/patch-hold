/** One contiguous range in a logical, 1-based universe. No controller mapping. */
export interface Position {
  universe: number;
  start: number;
}
export interface Fixture {
  id: string;
  name: string;
  location: string;
  mode: string;
  footprint: number;
}
export interface BaselineFixture extends Fixture, Position {}
export interface DesiredFixture extends Fixture {
  locked: boolean;
  allowedUniverses: number[];
}
export interface Reservation {
  universe: number;
  start: number;
  end: number;
  purpose: string;
}
export interface Project {
  schemaVersion: 1;
  title: string;
  universes: number[];
  baseline: BaselineFixture[];
  desired: DesiredFixture[];
  reservations: Reservation[];
}
export interface Assignment extends Position {
  id: string;
}
export type Status =
  | "invalid_input"
  | "minimum_proven"
  | "feasible_incomplete"
  | "no_solution_proven"
  | "budget_exhausted"
  | "cancelled";
export interface Budget {
  maxNodes: number;
  maxWork: number;
  maxMs: number;
}
export interface PlanResult {
  schemaVersion: 1;
  engineVersion: "0.1.0";
  status: Status;
  assignment: Assignment[] | null;
  addressChanges: number | null;
  nodes: number;
  work: number;
  elapsedMs: number;
  reason: string;
  errors: string[];
  budget: Budget;
  /** Canonical input binding, not a cryptographic authenticity certificate. */
  input: string;
}
export const LIMITS = Object.freeze({
  jsonBytes: 1_500_000,
  fixtures: 128,
  movable: 8,
  additions: 8,
  universes: 4,
  reservations: 128,
  text: 160,
  id: 64,
  maxNodes: 200_000,
  maxWork: 5_000_000,
  maxMs: 10_000,
});
export const DEFAULT_BUDGET: Budget = Object.freeze({
  maxNodes: 50_000,
  maxWork: 1_000_000,
  maxMs: 5_000,
});
export const NOTICE =
  "Planning output only. Verify fixture and console modes, addresses, mapping and cues before use. No hardware, compatibility or live-show safety guarantee.";
