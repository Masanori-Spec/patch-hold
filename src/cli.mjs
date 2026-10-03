#!/usr/bin/env node
import { open, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";
import { parseProject } from "./validation.ts";
import { solve } from "./solver.ts";
import { patchCsv, changesCsv, addressCards, manifest } from "./exports.ts";
import { LIMITS } from "./model.ts";
const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log(
    "PatchHold · local planning only\nnode src/cli.mjs INPUT.json [--out NEW_DIRECTORY] [--nodes 50000] [--work 1000000] [--ms 5000]\nAn output directory must not already exist. No file is overwritten.\nExit 0: minimum proven; 2: feasible incomplete; 3: no solution proven; 4: budget exhausted; 5: invalid input/error.",
  );
  process.exit(0);
}
try {
  const input = args.shift();
  if (!input || input.startsWith("--"))
    throw new Error("Input JSON path required");
  let out;
  const budget = {};
  const seen = new Set();
  while (args.length) {
    const flag = args.shift(),
      value = args.shift();
    if (
      !["--out", "--nodes", "--work", "--ms"].includes(flag) ||
      value === undefined ||
      seen.has(flag)
    )
      throw new Error("Unknown, repeated, or incomplete option");
    seen.add(flag);
    if (flag === "--out") out = resolve(value);
    else {
      if (!/^\d+$/.test(value)) throw new Error("Budget must be an integer");
      budget[
        { "--nodes": "maxNodes", "--work": "maxWork", "--ms": "maxMs" }[flag]
      ] = Number(value);
    }
  }
  const file = await open(
    resolve(input),
    constants.O_RDONLY | constants.O_NONBLOCK,
  );
  let data;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > LIMITS.jsonBytes)
      throw new Error(
        "Input must be a regular JSON file of at most 1,500,000 bytes",
      );
    const buf = Buffer.alloc(LIMITS.jsonBytes + 1);
    const { bytesRead } = await file.read(buf, 0, buf.length, 0);
    if (bytesRead > LIMITS.jsonBytes) throw new Error("Input too large");
    data = buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await file.close();
  }
  const project = parseProject(data),
    result = solve(project, budget);
  console.log(JSON.stringify(result, null, 2));
  if (
    out &&
    result.assignment &&
    ["minimum_proven", "feasible_incomplete"].includes(result.status)
  ) {
    // Generate and independently validate every byte before creating any output.
    const files = [
      ["patch.csv", patchCsv(project, result)],
      ["changes.csv", changesCsv(project, result)],
      ["address-cards.html", addressCards(project, result)],
      ["project.json", manifest(project, result)],
    ];
    await mkdir(out, { recursive: false, mode: 0o700 });
    for (const [name, content] of files)
      await writeFile(join(out, name), content, { flag: "wx", mode: 0o600 });
    console.error(`Wrote four planning files to ${out}`);
  }
  process.exitCode = {
    minimum_proven: 0,
    feasible_incomplete: 2,
    no_solution_proven: 3,
    budget_exhausted: 4,
    invalid_input: 5,
    cancelled: 6,
  }[result.status];
} catch (error) {
  console.error(`PatchHold: ${error.message}`);
  process.exitCode = 5;
}
