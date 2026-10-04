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

## Original local browser limitation

The authored Playwright suite defines 8 desktop/mobile runs covering worked output bytes, language switching, viewport overflow, keyboard generation, invalid locks, budget exhaustion, edits, repeated generation, cancellation, stale exports, local JSON import and reload.

The local suite was attempted, but all 8 runs stopped at browser launch: the Playwright Chromium headless executable was not present. **No browser assertions ran in that original local attempt.** No local browser was downloaded. The later hosted checks below supersede this browser-execution gap within their stated scope.

## Hosted browser and numerical acceptance, 2026-10-04

[Run 37167889180](https://github.com/Masanori-Spec/patch-hold/actions/runs/37167889180), commit `6f451edc9c27cd8702c6e80803a42fb32b4972df`, passed all three jobs:

- Node 24.21.0, UTC: 40 tests, strict TypeScript, compiled module graph and static build
- Node 24.21.0, Asia/Tokyo: the same 40-test aggregate
- Playwright 1.56.0 / Chromium 141 on Ubuntu 22.04 with the browser sandbox enabled: all 8 desktop and emulated Pixel 7 scenarios, no skips or retries

Actual browser downloads were saved and independently read back. Both CSV files and exported address-card HTML match `examples/worked-kit/` byte for byte. JSON inputs, assignment, one-change objective, search status and canonical input binding match; elapsed time and the browser's wall-clock budget appropriately differ from the CLI sample. Importing a saved result restores inputs and disables exports until a new search.

Desktop/mobile English/Japanese screenshots and the result panels were inspected. The narrow-screen tables stay inside horizontal scrolling containers. The actual exported HTML rendered four correct address cards; its A4 PDF is one page and was visually checked. These are sample-based layout checks, not a complete accessibility audit or a real-device browser matrix.

[Persisted evidence and download hashes](browser-evidence/evidence.json), [desktop](browser-evidence/desktop-en.png), [mobile](browser-evidence/mobile-ja.png), [print screenshot](browser-evidence/printed-cards.png), [PDF](browser-evidence/printed-cards.pdf), and [hosted benchmark](browser-evidence/benchmark-ci.json).

### Corrected test expectation

The first hosted run passed 6/8 browser cases. Two copies of one authored scenario incorrectly expected a feasible plan after changing A from 6 to 7 channels. That edit requires 17 channels in the available 16-channel range; the application correctly returned `no_solution_proven`. The test now explicitly verifies that outcome, restores A to 6 channels, then checks repeated generation and cancellation. No production solver or UI change was needed. The corrected suite passed all 8 cases.

## Remaining limits

No license was selected. Hardware behavior, electrical safety, manufacturer compatibility, live-show suitability, other browser engines, actual mobile devices, full accessibility conformance, user demand and patentability remain unvalidated. Eight dense synthetic benchmark cases still reach the work limit. Do not describe this bounded prototype as production-ready or universally optimal.
