# PatchHold

Local, bounded minimum-address-change DMX patch planning. Japanese-first browser UI with an English toggle, plus a CLI using the same TypeScript engine.

**Status: source-only release of a locally tested prototype. Publishing the source does not imply browser validation or hosted-CI execution. Browser assertions have not run because this environment has no Playwright Chromium executable. No hosted CI was activated.**

PatchHold starts with a valid current patch, desired mode footprints, hard address locks, and reserved ranges. It produces a full replacement patch CSV, a changes-only crew CSV, printable address-card HTML, and a versioned project/result JSON manifest.

The objective is exactly the count of existing fixtures whose `(logical universe, start address)` changes. It is **not** minimum labor, minimum configuration work, or cable-routing optimization. Mode/footprint changes are included on the crew checklist even when the address stays the same.

## Run locally

Node.js 24 or newer is required. The CLI, tests and static build use Node built-ins and do not need runtime dependencies.

```sh
node src/cli.mjs examples/worked.json --out ./new-change-kit --ms 0
node --test test/*.test.mjs
node scripts/build.mjs
node scripts/serve.mjs
```

Then open `http://127.0.0.1:4173` in a local browser. The server binds only to loopback. Browser computation occurs in a worker. Inputs remain in memory; export to save. There is no analytics, localStorage, remote profile fetch, network upload, or hardware control.

With development dependencies available:

```sh
npm ci
npm run verify
npm run benchmark
npm run test:browser
```

`verify` means TypeScript checking, Node tests, and static build. Browser tests are deliberately separate; a passed `verify` does not imply browser validation. Development versions are pinned in `package-lock.json`. During this build, an offline install was unavailable; existing local copies of those same pinned tools were used for checking. No new browser or software download was performed.

No license has been selected or added. No CI workflow has been installed or enabled.

## Worked example

The bundled fixtures are synthetic. Current A uses 1–4, B uses 5–8, and C is locked at 12–16. A expands to 6 channels, a 1-channel D is added, and 17–512 is reserved.

The engine proves one existing address change:

- A: U1 1–6, mode changed, address preserved
- B: U1 7–10, readdressed from 5
- C: U1 12–16, locked
- D: U1 11, new

`examples/worked-kit/` contains all four generated outputs and their verified assignment. They are examples, not manufacturer profiles.

## Supported numerical model

- One fixture occupies one contiguous interval entirely within 1–512 of one logical universe
- Up to 4 logical universes (labels 1–9999), 128 distinct IDs across current and desired inputs, 8 movable existing fixtures, 8 additions, and 128 reservations
- JSON imports are capped at 1,500,000 bytes, including saved manifests; maximum-size Unicode-labelled projects are round-trip tested
- Remaining existing fixtures must be address-locked; locked footprint changes still must fit
- Baseline footprints must not collide. Target footprint conflicts are the problem to solve
- Reservations apply to the desired plan; overlapping reservations have union semantics and may overlap baseline addresses
- A removed fixture does not appear in the target allocation. Additions and removals contribute no existing-address-change cost
- Intentional shared addressing, multiple DMX breaks, cross-universe fixtures, output mapping, profiles and controller-specific imports are unsupported
- A hard lock pins the baseline universe and start, not the old footprint. New fixtures cannot be locked without a baseline address

Logical labels are not Art-Net or sACN numbering and must not be interpreted as controller output mapping.

## Exact search statuses

- `invalid_input`: schema, range, baseline or resource-limit error
- `minimum_proven`: a feasible assignment with a proven minimum existing-address-change count
- `feasible_incomplete`: a feasible assignment, but the search budget ended before minimum was proven
- `no_solution_proven`: exhaustive search or a decisive fixed/domain contradiction proved no solution within this model
- `budget_exhausted`: no feasible plan was found before the limit; this does not prove impossibility
- `cancelled`: cancelled search; no assignment retained

Node and work limits are deterministic. `maxMs: 0` disables wall-clock cutoff for reproducible local comparisons. The default is 50,000 nodes / 1,000,000 counted work units / 5,000 ms; allowed maxima are 200,000 / 5,000,000 / 10,000 ms. Time limits may stop different machines at different nodes. Reaching the mathematical zero-cost lower bound proves minimum immediately without enumerating every assignment.

The engine uses fixed-range BigInt occupancy masks, complete legal-placement domains, deterministic MRV, and branch-and-bound. It retains the first equally optimal assignment in stable ID/candidate ordering, with no secondary optimality claim. See [algorithm and security notes](docs/ARCHITECTURE.md).

## Outputs and CLI

The CLI `--out` directory **must not exist**, including symlinks. Files are created exclusively and never overwritten. Choose a new directory for every run. If an OS write fails, a newly created directory may contain a partial kit; the CLI reports an error.

Exit codes: 0 minimum proven; 2 feasible incomplete; 3 no solution proven; 4 budget exhausted; 5 input/I/O error; 6 cancelled. Only feasible plans produce the four kit files. `--help` lists budget flags.

JSON import restores inputs only, including when importing a saved manifest. Saved assignments, search status and proof claims are deliberately discarded; regenerate before export. The independently checked feasibility certificate is input-bound, not a cryptographic signature or standalone proof of optimality.

CSV text cells neutralize spreadsheet formula prefixes and use quoted RFC-style cells. Neutralized text gets a leading apostrophe, so the JSON project remains the authoritative source for exact original labels. Printed HTML escapes all user strings and has a restrictive CSP. Technical output is English-compatible. The HTML cards include every target fixture plus removal cards; the changes CSV omits truly unchanged rows.

## Verification and measured limits

- 1,200 seeded randomized cases compared against an independent occupied-cell oracle
- 1,944 exhaustive reduced-capacity two-universe cases compared against an independent complete-tuple oracle
- Domain, locks, reservations, mode-only work, input bounds, escaping, CLI FIFO rejection and no-overwrite checks
- Synthetic benchmark: 12 fixed 512-channel scenarios; 4 completed, 8 reached the work budget. Dense 16-search-item cases are deliberately included and remain difficult
- 40 Node tests, TypeScript and build checks pass, including compiled module-graph validation; browser launch failed before assertions because the Chromium executable is absent

See [verification details](docs/VERIFICATION.md) and the [raw benchmark JSON](docs/benchmark-results.json). These are local Node measurements, not physical-fixture, browser-performance or full-rig scalability claims.

## Safety and scope

Planning output only. A technician must verify fixture and console modes, addresses, output mapping and cues. No compatibility, hardware-safety or live-show suitability guarantee is made. No live DMX, USB, MIDI, WebSerial, controller connection, networking protocol or automatic fixture action exists.

Existing tools already provide next-free placement, occupancy and patch sheets. PatchHold's bounded workflow combines baseline changes, hard constraints, honest search status and a crew change kit; it makes no novelty, patentability, customer-demand or commercialization claim. See [research sources](docs/SOURCES.md).

## 日本語での使い方

1. 現在のパッチを確認し、変更後の表でモード・チャンネル数・固定条件を編集します
2. 新規灯体や予約範囲を追加し、「計画を生成」を押します
3. 「最小変更数を証明済み」と「実行可能だが証明未完了」を区別して確認します
4. パッチ CSV・変更のみ CSV・印刷カード・計画 JSON を保存します
5. 灯体とコンソール双方の設定、出力先、キューを人が確認します

画面での編集・再生成・中止は古い出力を無効にします。データは自動保存しません。編集内容は入力 JSON として保存できます。上限に達した場合は制約や探索上限を見直してください。上限到達は「配置不可能」の意味ではありません。
