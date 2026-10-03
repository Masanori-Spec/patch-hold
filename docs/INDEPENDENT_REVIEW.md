# Independent technical review

Date: 2026-10-03 (UTC)

## Result

The bounded allocation model, exact objective, proof-status distinctions, independent feasibility checks, and CLI/export safeguards passed the review checks below. This is a **local numerical-model review**, not a visual/browser acceptance pass or physical lighting-system validation.

`npm run verify` passed after the hardening fixes: TypeScript typecheck, all 40 Node tests, and the static-app build. Fifteen tests in `test/reviewer.test.mjs` were added during independent review, alongside the builder's tests.

## Independent oracle

The reviewer oracle enumerates complete Cartesian products in input order. It checks completed assignments using ordinary occupied-channel sets, then computes cost directly from baseline universe/start pairs. It does not use the production solver's bitsets, MRV selection, candidate precomputation, pruning, or objective implementation.

All 1,944 combinations in this deliberately small exhaustive family matched:

- Two universes, each limited by reservations to three usable channels
- Two existing fixtures at baseline U1:1 and U1:3
- Each desired footprint independently chosen from 1, 2, and 3
- Each fixture independently locked or movable
- Each fixture allowed U1 only, U2 only, or both
- Zero additions, a one-channel addition, or a two-channel addition
- With and without a reservation of U2:2

Every feasible case returned the same minimum address-change count as the independent oracle. Every infeasible case returned `no_solution_proven`. This finite-family check is strong regression evidence; it is not a mathematical proof for every supported input.

## Adversarial checks

The reviewer suite also checks:

- Additions and removals do not count as existing address changes
- Mode/footprint changes stay in the change checklist even with a locked, unchanged address
- Inclusive channel 512, illegal boundary crossing, and forbidden-universe locks
- Reservations that overlap the baseline and overlapping reservations with union semantics
- Work, node, and time cutoffs without false infeasibility claims
- A real positive-cost incumbent under interruption, and cancellation after an incumbent exists
- Strict numeric values, sparse arrays, prototype-looking IDs, foreign object prototypes, limits, and oversized input
- Input-bound exports and deliberate disregard of fabricated saved results on import
- Spreadsheet formula neutralization and inert HTML rendering of hostile labels
- Existing output-directory preservation, oversized files, repeated/invalid CLI options, and nonblocking rejection of FIFO input

A small reproducible incomplete-incumbent case uses existing fixtures at starts 1, 3, and 5; desired footprints 3, 3, and 1; and only channels 1–7 available. Node limits 4–8 yield `feasible_incomplete` with cost 2. A sufficient budget proves cost 2. Cancellation during the remaining exploration discards the incumbent.

## Findings corrected

1. Array validation originally used `Array.some`, which skips sparse holes. Sparse allowed-universe arrays could pass validation and then cause a BigInt/type error. Validation now inspects spread elements, so holes become invalid `undefined` values.
2. The CLI originally opened files with blocking `r` before checking regular-file status. A FIFO could block in `open`. The input is now opened nonblocking and rejected after descriptor-based status checking.
3. Explicit null budget fields originally selected defaults through nullish coalescing. Defaults now apply only to undefined fields; malformed explicit nulls are rejected.
4. Oversized sparse universe arrays were still filtered after the four-universe limit was detected. Copying is now capped before filtering, so invalid-length programmatic arrays do not cause a scan over their entire length. A counted-access regression verifies this without constructing a huge populated input.

5. A formatting pass changed TypeScript imports to double quotes, while the build script rewrote only single-quoted `.ts` suffixes. The generated modules therefore still requested missing TypeScript paths despite the source-engine tests passing. The builder corrected rewriting for both quote styles and added `test/build.test.mjs`, which checks compiled relative imports and source/compiled engine parity on the demo plus 30 seeded cases. Independent review reran the complete 39-test aggregate successfully. A separate Node-only smoke check also exercised the compiled worker message contract and all four compiled export serializers; this does not validate a real browser worker or browser downloads.

6. Valid large Unicode manifests exceeded the former 256,000-byte import cap because a result manifest contains both the project and its canonical input binding. The bounded raw JSON cap is now 1,500,000 bytes; fixture, string, reservation, and search caps are unchanged. A new regression round-trips input and result manifests at the maximum row and string-length limits. An independent four-universe case with 128 fixtures and 128 reservations produced a 1,098,326-byte result manifest that round-tripped successfully; cap-plus-one input was rejected. The reviewer oversized-input fixtures now derive their boundary from `LIMITS.jsonBytes`, while the unrelated 256-length sparse-array regression remains unchanged.

The regression tests for all six fixes pass. Minor UI status consistency and an authored cancellation test that could skip its cancellation path were also corrected during source review; the browser tests remain unrun.

## Browser review and limits

Source review covered revision-bound result handling, worker termination on edit/cancel/reset, stale-result rejection, local import/export flow, and text-only rendering. Those observations do not substitute for running browser interactions.

The authored Playwright scenarios have **not passed in this environment**: the builder's launch attempt lacked the required Playwright Chromium executable, so no browser assertions ran. An independent attempt using the supported cloud browser against the running local preview was blocked with `net::ERR_BLOCKED_BY_CLIENT`. No alternative protocol, sandbox relaxation, public deployment, or hosted CI activation was used to bypass that restriction.

Visual layout, mobile rendering, actual browser downloads, keyboard operation, and interrupted browser flows remain acceptance gates for a supported browser environment.

## Performance and deployment scope

The recorded 12-scenario synthetic Node benchmark completed four scenarios and honestly reported eight as incomplete. Dense 16-search-item cases therefore must not be advertised as generally optimal or universally solvable within the default budget. Browser-scale timing remains unverified.

This review did not publish source, activate hosted CI, deploy the app, contact a customer, connect to hardware, verify controller compatibility, or establish commercial demand or novelty. Every exported plan still requires fixture/console mode, address, mapping, and cue verification before use.
