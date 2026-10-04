# Verification record

Date: 2026-10-03. Runtime: Node v24.19.0, Linux. Synthetic examples only.

## Passed locally

- TypeScript strict check of shared core and worker
- Node tests, including 1,200 seeded random small-instance comparisons and an independent reviewer's 1,944 exhaustive two-universe complete-tuple comparisons
- Baseline/target distinction; footprint/address 1 and 512 boundaries; sparse arrays; duplicate/prototype IDs; strict numerical types; lock and reservation constraints; removals/new fixtures; deterministic work accounting and row-independent ties
- Complete/incomplete search statuses, incumbent-at-interruption, cancellation, no false infeasibility on cutoff
- Independent feasibility validation and stale-input export rejection
- Formula-prefix and HTML escaping; CSV quoted/newline cells; JSON round-trip, ignoring saved result claims; bounded filenames
- Maximum supported Unicode-labelled project/result manifest round-trip under the 1,500,000-byte input cap
- CLI four-file output, no overwrite of existing directories/symlinks, input byte cap, and FIFO rejection without blocking
- Static browser build and JavaScript syntax checks; compiled module-path resolution and compiled/source engine parity on the worked example plus 30 seeded cases

See the test files for exact coverage; aggregate `npm run verify` includes no browser pass claim.

## Benchmark

`node scripts/benchmark.mjs` produced `benchmark-results.json` with default bounds (50,000 nodes, 1,000,000 counted work units, 5 seconds).

Of 12 fixed synthetic scenarios, 4 completed: the worked example, a 128-fixture/8-movable case, 120 locked fixtures plus 8 additions, and an adversarial fragmented no-slot case. Eight dense cases with 16 search items reached the work limit: four retained feasible but unproven incumbents, and four found no solution within budget. **No minimum or impossibility was claimed for those eight.**

These measurements justify bounded prototype caps, not a promise that every allowed input completes. Exact times are machine-dependent; consult the raw file. No browser performance or live-rig conclusions follow.

## Not validated

The authored Playwright suite defines 8 desktop/mobile runs covering worked output bytes, language switching, viewport overflow, keyboard generation, invalid locks, budget exhaustion, edits, repeated generation, cancellation, stale exports, local JSON import and reload.

The local suite was attempted, but all 8 runs stopped at browser launch: the Playwright Chromium headless executable was not present. **No browser assertions ran.** No browser was downloaded. Visual layout, keyboard/accessibility behavior, worker/CSP integration, downloads and print rendering remain unverified in a real browser.

The original source-only release had no hosted CI. A verification workflow is now included with two Node 24 numerical jobs (UTC and Asia/Tokyo) and desktop/mobile Chromium scenarios with the browser sandbox enabled. Its actual run status, exported files and screenshots must be inspected before claiming browser acceptance. No license was selected. Hardware behavior, electrical safety, manufacturer compatibility, real-show suitability, user demand and patentability were not tested.

The browser suite now preserves the actual four downloaded files, compares CSV and HTML bytes with the worked example, checks the JSON assignment and canonical input binding, renders exported address cards to screenshots/PDF, and records English/Japanese page and result screenshots. These checks are authored, not yet a recorded pass.

## Remaining browser acceptance gate

Run the authored browser suite in an authorized environment with the pinned Chromium runtime, inspect desktop/mobile screenshots and printable cards, and fix any failures. Verify source and output hashes when publishing source or later updates. Do not describe this prototype as production-ready while that gate remains open.
