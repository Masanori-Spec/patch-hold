# Architecture and trust boundaries

## Pure core

`model.ts` defines the versioned shape and limits. `validation.ts` checks types and copies only declared fields into normalized data. Unknown fields are rejected so unsupported split/shared addressing cannot be silently reinterpreted. Maps/Sets are used for user IDs, including prototype-looking strings. JSON import is capped at 1,500,000 UTF-8 bytes, string fields at 160 UTF-16 code units and IDs at 64. Sparse in-memory arrays are rejected too. The byte limit covers the worst supported Unicode-labelled saved manifest, including its canonical input binding, so an exported maximum-size project can be reimported.

`solver.ts` creates one BigInt occupancy mask per logical universe. Reservations are unioned. Locked desired ranges are placed first using their **desired** footprint. A locked range outside the boundary, outside allowed universes or colliding with another fixed range proves infeasibility. Every candidate for a remaining fixture is precomputed from all allowed universe/start combinations; candidates never cross channel 512. Fixed ranges are filtered out without heuristic truncation.

Depth-first search uses minimum remaining values, then larger footprint, then code-unit ID order. Each candidate is ordered by its individual address-change cost, universe, then start. The cost of a new fixture is always zero. The independent minimum available cost for each remaining fixture is a valid additive lower bound. A subtree is pruned only if that bound cannot improve the incumbent. The first equally optimal assignment is retained. Row order and locale do not affect ties.

A work unit counts each fixture preparation, each candidate construction attempt, each recursive visit, and each candidate occupancy check during MRV. The counter stops before exceeding the declared work budget. Nodes count entered recursive visits and stop before exceeding the node budget. Fixed-size input validation/serialization is outside that work count. The clock check occurs at work checks; it is a responsive bound, not a hard real-time deadline.

If complete search finishes, optimality or infeasibility is proven in this numerical model. A feasible zero-cost assignment also reaches a global lower bound. Otherwise budget exhaustion cannot prove minimum or infeasibility. Cancellation discards incumbents. Browser cancellation terminates the worker and invalidates result state.

## Independent validation

Every returned assignment is validated by a separate implementation that enumerates occupied cells in a Set, without sharing solver masks or domain generation. It checks IDs, full coverage, allowed universes, 1–512 ranges, locks, pairwise collision/reservations, and recomputes address-change cost.

`validateCertificate` additionally checks exact canonical input binding, engine/schema version and feasible status. It is a **feasibility/input-binding check**, not a signature or externally verifiable proof of optimality. Status can only be relied on for an actual solver run; imported manifests intentionally ignore saved result claims and require regeneration.

## Browser lifecycle

The UI maintains a monotonically increasing revision. Every project/budget edit, import, demo reset, cancellation or generation invalidates the prior result, clears export availability and terminates the old worker. Replies must match the active revision and worker request ID. File reads also use revision guards. Switching languages keeps the project/result and does not trigger a new search. A watchdog terminates workers that do not respond within 11 seconds; normal search time is capped at 5 seconds.

All table content and status strings use DOM `textContent`/input values, never user HTML. Static assets have a restrictive CSP; the local HTTP server also sends security headers and accepts only loopback Host headers. The server does not list directories, expose source files, or allow writes. Application code does not fetch remote resources or use networking, hardware APIs or persistence.

## Output boundary

Output generation first validates feasibility and canonical input binding. CSV quotes every cell, doubles internal quotes, uses CRLF records and a UTF-8 BOM, and prefixes text that could become a spreadsheet formula, including whitespace/control-leading variants. HTML interpolations use escaping; address-card HTML includes no script or external resource. IDs/names never become file paths. Browser filenames use a bounded ASCII sanitizer.

The CLI reads at most the input byte cap, opens in nonblocking mode, and verifies a regular file (including rejecting FIFO input). It computes all four outputs before creating the destination. The destination directory and files must not already exist; files are opened with exclusive creation. It never forces an overwrite or deletes a user's existing path. OS failures may leave a partial newly created kit; this is reported as failure.
