import type { Project, PlanResult, Assignment } from "./model.ts";
import { NOTICE } from "./model.ts";
import { validateProject, validateCertificate } from "./validation.ts";
export interface ChangeRow {
  id: string;
  name: string;
  location: string;
  action: string;
  previousMode: string;
  mode: string;
  footprint: number;
  previousUniverse: number | string;
  previousStart: number | string;
  universe: number | string;
  start: number | string;
  end: number | string;
  locked: boolean;
  checklist: string;
}
export function changeRows(project: Project, result: PlanResult): ChangeRow[] {
  const p = validateProject(project),
    errors = validateCertificate(p, result);
  if (errors.length) throw new Error(errors.join("; "));
  const old = new Map(p.baseline.map((f) => [f.id, f])),
    desired = new Map(p.desired.map((f) => [f.id, f])),
    positions = new Map(result.assignment!.map((a) => [a.id, a]));
  const rows: ChangeRow[] = [];
  for (const f of p.desired) {
    const b = old.get(f.id),
      a = positions.get(f.id)!,
      moved = !!b && (b.universe !== a.universe || b.start !== a.start),
      mode = !!b && (b.mode !== f.mode || b.footprint !== f.footprint),
      renamed = !!b && (b.name !== f.name || b.location !== f.location);
    const action = !b
      ? "new"
      : [
          ...(moved ? ["readdress"] : []),
          ...(mode ? ["mode/footprint"] : []),
          ...(renamed ? ["label/location"] : []),
        ].join("+") || "unchanged";
    const checklist = !b
      ? "Set fixture and console mode/address; verify mapping and cues"
      : action === "unchanged"
        ? "Verify fixture and console settings"
        : `${mode ? "Set fixture and console mode/footprint; " : ""}${moved ? "Set fixture and console address; " : ""}${renamed ? "Verify labels/location; " : ""}verify mapping and cues`;
    rows.push({
      id: f.id,
      name: f.name,
      location: f.location,
      action,
      previousMode: b?.mode ?? "",
      mode: f.mode,
      footprint: f.footprint,
      previousUniverse: b?.universe ?? "",
      previousStart: b?.start ?? "",
      universe: a.universe,
      start: a.start,
      end: a.start + f.footprint - 1,
      locked: f.locked,
      checklist,
    });
  }
  for (const b of p.baseline)
    if (!desired.has(b.id))
      rows.push({
        id: b.id,
        name: b.name,
        location: b.location,
        action: "removed",
        previousMode: b.mode,
        mode: "",
        footprint: 0,
        previousUniverse: b.universe,
        previousStart: b.start,
        universe: "",
        start: "",
        end: "",
        locked: false,
        checklist:
          "Remove old console patch; verify removal in fixture inventory and cues",
      });
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/** Quote every cell; neutralize spreadsheet formulas after any leading whitespace/control characters. */
export function csvCell(value: unknown): string {
  let s = String(value);
  if (/^[\s\u0000-\u0020\u007f-\u009f]*[=+\-@]/u.test(s) || /^[\t\r\n]/.test(s))
    s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
const csv = (rows: unknown[][]) =>
  "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
export function patchCsv(p: Project, r: PlanResult): string {
  const rows = changeRows(p, r).filter((f) => f.action !== "removed");
  return csv([
    [
      "id",
      "name",
      "location",
      "logical_universe",
      "start",
      "end",
      "mode",
      "footprint",
      "locked",
      "previous_universe",
      "previous_start",
      "action",
      "plan_version",
      "search_status",
      "notice",
    ],
    ...rows.map((f) => [
      f.id,
      f.name,
      f.location,
      f.universe,
      f.start,
      f.end,
      f.mode,
      f.footprint,
      f.locked,
      f.previousUniverse,
      f.previousStart,
      f.action,
      "1 / engine 0.1.0",
      r.status,
      NOTICE,
    ]),
  ]);
}
export function changesCsv(p: Project, r: PlanResult): string {
  return csv([
    [
      "id",
      "name",
      "location",
      "action",
      "previous_mode",
      "target_mode",
      "previous_universe",
      "previous_start",
      "target_universe",
      "target_start",
      "target_end",
      "target_footprint",
      "locked",
      "checklist",
      "plan_version",
      "search_status",
      "notice",
    ],
    ...changeRows(p, r)
      .filter((f) => f.action !== "unchanged")
      .map((f) => [
        f.id,
        f.name,
        f.location,
        f.action,
        f.previousMode,
        f.mode,
        f.previousUniverse,
        f.previousStart,
        f.universe,
        f.start,
        f.end,
        f.footprint,
        f.locked,
        f.checklist,
        "1 / engine 0.1.0",
        r.status,
        NOTICE,
      ]),
  ]);
}
export const html = (s: unknown): string =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export function addressCards(p: Project, r: PlanResult): string {
  const rows = changeRows(p, r);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>PatchHold address cards</title><style>body{font:14px system-ui;color:#111;max-width:1000px;margin:24px auto;padding:16px}h1{font-size:25px}header p{max-width:90ch}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:2px solid #333;padding:18px;break-inside:avoid;overflow-wrap:anywhere}.address{font-size:28px;font-weight:800;margin:12px 0}.card h2{font-size:18px;margin:0}.muted{font-size:12px}.check{line-height:1.8}@media print{body{margin:0;padding:0}.card{page-break-inside:avoid}}@media(max-width:600px){.cards{grid-template-columns:1fr}}</style></head><body><header><h1>PatchHold · ${html(p.title)}</h1><p>${html(NOTICE)}</p><p>Plan v1 · engine 0.1.0 · ${html(r.status)} · ${r.addressChanges} existing address changes. Logical universe labels only; verify output mapping. This status concerns the supported numerical model only.</p></header><main class="cards">${rows.map((f) => `<article class="card"><h2>${html(f.name || f.id)}</h2><p>${html(f.id)} · ${html(f.location)} · ${html(f.action)}</p><div class="address">${f.action === "removed" ? "REMOVE" : `U${f.universe} · ${f.start}–${f.end}`}</div><p>Mode: ${html(f.mode || "(removed)")} · ${f.footprint} channels · ${f.locked ? "ADDRESS LOCKED" : "unlocked"}</p><p class="muted">Previous: ${f.previousUniverse !== "" ? `U${f.previousUniverse} · ${f.previousStart} · ${html(f.previousMode)}` : "new fixture"}</p><p>${html(f.checklist)}</p><p class="check">□ Fixture settings checked<br>□ Console settings and cues checked</p></article>`).join("")}</main></body></html>`;
}
export function manifest(p: Project, r?: PlanResult): string {
  p = validateProject(p);
  if (r) {
    const errors = validateCertificate(p, r);
    if (errors.length) throw new Error(errors.join("; "));
  }
  return (
    JSON.stringify(
      {
        kind: "patchhold-manifest",
        schemaVersion: 1,
        project: p,
        ...(r ? { result: r } : {}),
        notice: NOTICE,
        importPolicy:
          "Saved results are informational only. Import restores the project; generate again to verify.",
      },
      null,
      2,
    ) + "\n"
  );
}
export function safeFilename(name: string): string {
  const s = name
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "patchhold";
}
