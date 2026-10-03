import example from "./example.mjs";
import {
  parseProject,
  validateProject,
  validateCertificate,
} from "./core/validation.js";
import {
  patchCsv,
  changesCsv,
  addressCards,
  manifest,
  changeRows,
  safeFilename,
} from "./core/exports.js";
import { LIMITS } from "./core/model.js";
const $ = (id) => document.getElementById(id),
  clone = (x) => structuredClone(x);
let project = clone(example),
  language = "ja",
  revision = 0,
  worker = null,
  watchdog = null,
  result = null,
  solvedProject = null,
  statusKey = "ready",
  statusExtra = "";
const original = new Map(
  [...document.querySelectorAll("[data-i18n]")].map((e) => [
    e.dataset.i18n,
    e.textContent,
  ]),
);
const en = {
  eyebrow: "KEEP THE PATCH. CHANGE THE PLAN.",
  headline: "Change only the\naddresses you need to.",
  lead: "Start with an existing patch. Plan mode changes, additions, locks and reserved ranges. Get an auditable search status and a crew-ready change kit.",
  local:
    "Local processing · export to save\nNo hardware connection or transmission",
  notice:
    "Planning output only. Verify fixture and console modes, addresses, mapping and cues. No hardware compatibility or safety guarantee.",
  project: "01 / PROJECT",
  demo: "Load demo",
  import: "Import JSON",
  save: "Save input JSON",
  title: "Plan title",
  universes: "Logical universes (comma-separated)",
  limits:
    "Up to 4 universes / 128 fixtures / 8 movable existing fixtures / 8 additions. One contiguous range per fixture. No split breaks, cross-universe or shared addressing.",
  baseline: "02 / CURRENT PATCH",
  addBaseline: "Add existing fixture",
  baselineHint:
    "Enter the current patch accurately. Edit the desired state separately below.",
  desired: "03 / DESIRED PATCH",
  addDesired: "Add new fixture",
  desiredHint:
    "A lock preserves the current universe and start address. Mode changes remain on the crew checklist even if the address stays the same.",
  reservations: "04 / RESERVED RANGES",
  addReservation: "Add reservation",
  generateTitle: "Keep address changes small",
  objective:
    "The objective counts existing universe/start-address changes. It does not minimize labor or cable routing.",
  nodes: "Maximum search nodes",
  work: "Maximum search work units",
  generate: "Generate plan",
  cancel: "Cancel",
  results: "05 / RESULT & CHANGE KIT",
  ready: "Review the inputs, then generate a plan.",
  patch: "Full patch CSV",
  changes: "Changes-only CSV",
  cards: "Printable cards HTML",
  manifest: "Plan JSON",
  footer:
    "Prototype software for a bounded numerical planning model. Its workflow combines baseline changes, hard locks, honest proof status and a change kit. Novelty and customer demand are not established.",
};
const messages = {
  ready: [
    "入力を確認して計画を生成してください。",
    "Review the inputs, then generate a plan.",
  ],
  edited: [
    "入力が変更されました。再生成するまで出力できません。",
    "Inputs changed. Generate again to enable exports.",
  ],
  running: [
    "探索中。編集または中止すると、この探索は破棄されます。",
    "Searching. Editing or cancelling discards this run.",
  ],
  cancelled: [
    "中止しました。計画は保存されていません。",
    "Cancelled. No plan was retained.",
  ],
  minimum_proven: [
    "最小変更数を証明済み（対応する数値モデル内）",
    "Minimum address-change count proven within the supported model",
  ],
  feasible_incomplete: [
    "実行可能な計画あり。探索が未完了のため最小とは証明できていません。",
    "Feasible plan found; minimum is not proven because search is incomplete.",
  ],
  no_solution_proven: [
    "この条件では配置不可と証明済み（対応する数値モデル内）",
    "No solution proven within the supported model",
  ],
  budget_exhausted: [
    "探索上限までに計画が見つかりませんでした。配置不可の証明ではありません。",
    "No solution found within the budget. This does not prove impossibility.",
  ],
  invalid_input: ["入力を修正してください。", "Please correct the inputs."],
  error: [
    "処理できませんでした。出力は無効です。",
    "Could not complete this run. Exports are disabled.",
  ],
  saved: ["入力 JSON を保存しました。", "Input JSON saved."],
};
function setStatus(key, extra = "") {
  statusKey = key;
  statusExtra = extra;
  const m = messages[key];
  $("status").textContent =
    (m ? m[language === "ja" ? 0 : 1] : key) + (extra ? "\n" + extra : "");
  $("status-badge").textContent = key.toUpperCase().replaceAll("_", " ");
}
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function exportsEnabled(enabled) {
  for (const id of [
    "export-patch",
    "export-changes",
    "export-cards",
    "export-project",
  ])
    $(id).disabled = !enabled;
}
function stop() {
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(watchdog);
  watchdog = null;
  $("cancel").disabled = true;
}
function invalidate(key = "edited") {
  revision++;
  stop();
  result = null;
  solvedProject = null;
  exportsEnabled(false);
  $("metrics").replaceChildren();
  $("occupancy").replaceChildren();
  $("result-table").replaceChildren();
  setStatus(key);
}
function nums(v) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}
const headers = {
  id: ["ID", "ID"],
  name: ["名前", "Name"],
  location: ["位置", "Location"],
  mode: ["モード", "Mode"],
  footprint: ["CH 数", "Channels"],
  universe: ["論理 U", "Logical U"],
  start: ["開始", "Start"],
  end: ["終了", "End"],
  locked: ["アドレス固定", "Address lock"],
  allowedUniverses: ["許可 U", "Allowed U"],
  purpose: ["用途", "Purpose"],
};
function table(container, rows, fields, kind) {
  const t = el("table"),
    head = el("tr");
  for (const f of fields)
    head.append(el("th", headers[f][language === "ja" ? 0 : 1]));
  head.append(el("th", language === "ja" ? "操作" : "Action"));
  const thead = el("thead");
  thead.append(head);
  t.append(thead);
  const body = el("tbody");
  rows.forEach((row, index) => {
    const tr = el("tr");
    for (const field of fields) {
      const td = el("td"),
        input = el("input");
      input.setAttribute(
        "aria-label",
        `${kind} ${row.id || index + 1} ${headers[field][language === "ja" ? 0 : 1]}`,
      );
      if (field === "locked") {
        input.type = "checkbox";
        input.checked = row[field];
      } else if (["footprint", "universe", "start", "end"].includes(field)) {
        input.type = "number";
        input.min = "1";
        input.max = field === "universe" ? "9999" : "512";
        input.value = row[field];
      } else {
        input.type = "text";
        input.maxLength = field === "id" ? 64 : 160;
        input.value = Array.isArray(row[field])
          ? row[field].join(",")
          : row[field];
        if (field === "id") input.className = "id";
      }
      input.addEventListener("input", () => {
        row[field] =
          field === "locked"
            ? input.checked
            : field === "allowedUniverses"
              ? nums(input.value)
              : input.type === "number"
                ? Number(input.value)
                : input.value;
        invalidate();
      });
      td.append(input);
      tr.append(td);
    }
    const td = el("td"),
      remove = el("button", language === "ja" ? "削除" : "Remove", "remove");
    remove.type = "button";
    remove.setAttribute(
      "aria-label",
      `${language === "ja" ? "削除" : "Remove"} ${kind} ${row.id || index + 1}`,
    );
    remove.onclick = () => {
      rows.splice(index, 1);
      invalidate();
      renderTables();
    };
    td.append(remove);
    tr.append(td);
    body.append(tr);
  });
  t.append(body);
  $(container).replaceChildren(t);
}
function renderTables() {
  table(
    "baseline-table",
    project.baseline,
    ["id", "name", "location", "mode", "footprint", "universe", "start"],
    "baseline",
  );
  table(
    "desired-table",
    project.desired,
    [
      "id",
      "name",
      "location",
      "mode",
      "footprint",
      "locked",
      "allowedUniverses",
    ],
    "desired",
  );
  table(
    "reservation-table",
    project.reservations,
    ["universe", "start", "end", "purpose"],
    "reservation",
  );
  $("title").value = project.title;
  $("universes").value = project.universes.join(",");
}
function translate() {
  document.documentElement.lang = language;
  $("language").textContent = language === "ja" ? "English" : "日本語";
  for (const e of document.querySelectorAll("[data-i18n]"))
    e.textContent =
      language === "en" ? en[e.dataset.i18n] : original.get(e.dataset.i18n);
  setStatus(statusKey, statusExtra);
  renderTables();
  if (result) renderResult();
}
$("language").onclick = () => {
  language = language === "ja" ? "en" : "ja";
  translate();
};
$("title").oninput = (e) => {
  project.title = e.target.value;
  invalidate();
};
$("universes").oninput = (e) => {
  project.universes = nums(e.target.value);
  invalidate();
};
for (const id of ["nodes", "work"]) $(id).oninput = () => invalidate();
$("demo").onclick = () => {
  project = clone(example);
  invalidate("ready");
  renderTables();
};
function nextId() {
  let i = 1;
  const used = new Set(
    [...project.baseline, ...project.desired].map((f) => f.id),
  );
  while (used.has(`F${i}`)) i++;
  return `F${i}`;
}
$("add-desired").onclick = () => {
  if (project.desired.length >= 128) {
    invalidate("error");
    setStatus("error", "128 fixtures maximum");
    return;
  }
  project.desired.push({
    id: nextId(),
    name: "New fixture",
    location: "",
    mode: "1ch",
    footprint: 1,
    locked: false,
    allowedUniverses: [project.universes[0] || 1],
  });
  invalidate();
  renderTables();
};
$("add-baseline").onclick = () => {
  if (project.baseline.length >= 128 || project.desired.length >= 128) {
    invalidate("error");
    setStatus("error", "128 fixtures maximum");
    return;
  }
  const f = {
    id: nextId(),
    name: "Existing fixture",
    location: "",
    mode: "1ch",
    footprint: 1,
    universe: project.universes[0] || 1,
    start: 1,
  };
  project.baseline.push(f);
  const { universe, start, ...base } = f;
  project.desired.push({ ...base, locked: true, allowedUniverses: [universe] });
  invalidate();
  renderTables();
};
$("add-reservation").onclick = () => {
  if (project.reservations.length >= 128) {
    invalidate("error");
    setStatus("error", "128 reservations maximum");
    return;
  }
  project.reservations.push({
    universe: project.universes[0] || 1,
    start: 1,
    end: 1,
    purpose: "",
  });
  invalidate();
  renderTables();
};
$("import").onchange = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  invalidate();
  const token = revision;
  try {
    if (file.size > LIMITS.jsonBytes)
      throw new Error("JSON exceeds 1,500,000 bytes");
    const text = await file.text();
    if (token !== revision) return;
    project = parseProject(text);
    invalidate("ready");
    renderTables();
  } catch (e) {
    if (token === revision) setStatus("invalid_input", e.message);
  }
};
function download(text, name, type) {
  const blob = new Blob([text], { type }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("save").onclick = () => {
  try {
    download(
      manifest(validateProject(project)),
      safeFilename(project.title) + "-input.json",
      "application/json",
    );
  } catch (e) {
    setStatus("invalid_input", e.message);
  }
};
$("cancel").onclick = () => invalidate("cancelled");
$("generate").onclick = () => {
  invalidate();
  let p;
  try {
    p = validateProject(project);
  } catch (e) {
    setStatus("invalid_input", e.message);
    return;
  }
  const token = revision,
    budget = {
      maxNodes: Number($("nodes").value),
      maxWork: Number($("work").value),
      maxMs: 5000,
    };
  setStatus("running");
  $("cancel").disabled = false;
  try {
    worker = new Worker(new URL("./core/worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      if (token !== revision || e.data.id !== token) return;
      stop();
      if (e.data.error) {
        setStatus("error", e.data.error);
        return;
      }
      const r = e.data.result;
      setStatus(r.status, r.errors.join("\n"));
      if (
        r.assignment &&
        ["minimum_proven", "feasible_incomplete"].includes(r.status)
      ) {
        const errors = validateCertificate(p, r);
        if (errors.length) {
          setStatus("error", errors.join("\n"));
          return;
        }
        result = r;
        solvedProject = p;
        exportsEnabled(true);
        renderResult();
      } else renderMetrics(r);
    };
    worker.onerror = () => {
      if (token !== revision) return;
      invalidate("error");
    };
    watchdog = setTimeout(() => {
      if (token === revision) invalidate("error");
    }, 11000);
    worker.postMessage({ id: token, project: p, budget });
  } catch (e) {
    invalidate("error");
    setStatus("error", e.message);
  }
};
function renderMetrics(r) {
  const values = [
    [
      r.addressChanges ?? "—",
      language === "ja" ? "既存アドレス変更" : "existing address changes",
    ],
    [r.nodes, language === "ja" ? "探索ノード" : "search nodes"],
    [r.work, language === "ja" ? "探索作業単位" : "search work units"],
    [`${r.elapsedMs} ms`, language === "ja" ? "経過時間" : "elapsed"],
  ];
  $("metrics").replaceChildren(
    ...values.map(([n, label]) => {
      const box = el("div", undefined, "metric");
      box.append(el("strong", n), el("span", label));
      return box;
    }),
  );
}
function renderResult() {
  renderMetrics(result);
  const rows = changeRows(solvedProject, result),
    t = el("table"),
    thead = el("thead"),
    hr = el("tr");
  for (const h of language === "ja"
    ? ["灯体 / 位置", "変更", "以前", "目標", "モード / CH", "確認リスト"]
    : [
        "Fixture / location",
        "Action",
        "Previous",
        "Target",
        "Mode / channels",
        "Checklist",
      ])
    hr.append(el("th", h));
  thead.append(hr);
  t.append(thead);
  const body = el("tbody");
  for (const f of rows) {
    const tr = el("tr");
    for (const value of [
      `${f.id} · ${f.name} / ${f.location}`,
      f.action,
      f.previousUniverse !== ""
        ? `U${f.previousUniverse}:${f.previousStart} (${f.previousMode})`
        : "—",
      f.action === "removed" ? "—" : `U${f.universe}:${f.start}–${f.end}`,
      `${f.mode} / ${f.footprint}`,
      f.checklist,
    ])
      tr.append(el("td", value));
    if (f.action !== "unchanged") tr.children[1].className = "changed";
    body.append(tr);
  }
  t.append(body);
  $("result-table").replaceChildren(t);
  const views = [];
  for (const u of solvedProject.universes) {
    const slots = Array(512).fill("free");
    for (const r of solvedProject.reservations.filter((r) => r.universe === u))
      for (let c = r.start; c <= r.end; c++) slots[c - 1] = "reserved";
    for (const f of rows.filter((f) => f.universe === u))
      for (let c = f.start; c <= f.end; c++) slots[c - 1] = "fixture";
    const section = el("div", undefined, "universe"),
      free = slots.filter((x) => x === "free").length;
    section.append(
      el(
        "p",
        `U${u} · ${512 - free}/512 ${language === "ja" ? "使用・予約" : "used or reserved"} · ${free} ${language === "ja" ? "空き" : "free"}`,
      ),
    );
    const bar = el("div", undefined, "bar");
    bar.setAttribute("aria-hidden", "true");
    for (const slot of slots) bar.append(el("span", undefined, `cell-${slot}`));
    section.append(bar);
    views.push(section);
  }
  $("occupancy").replaceChildren(...views);
}
for (const [id, fn, suffix, mime] of [
  ["export-patch", patchCsv, "patch.csv", "text/csv;charset=utf-8"],
  ["export-changes", changesCsv, "changes.csv", "text/csv;charset=utf-8"],
  [
    "export-cards",
    addressCards,
    "address-cards.html",
    "text/html;charset=utf-8",
  ],
  ["export-project", manifest, "project.json", "application/json"],
])
  $(id).onclick = () => {
    if (!result || !solvedProject) return;
    try {
      const errors = validateCertificate(validateProject(project), result);
      if (errors.length) throw new Error(errors.join("; "));
      download(
        fn(solvedProject, result),
        safeFilename(project.title) + "-" + suffix,
        mime,
      );
    } catch (e) {
      invalidate("error");
      setStatus("error", e.message);
    }
  };
renderTables();
