import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const root = new URL("../", import.meta.url),
  dest = new URL("dist/", root);
await mkdir(dest, { recursive: true });
await mkdir(new URL("core/", dest), { recursive: true });
for (const name of ["model", "validation", "solver", "exports", "worker"]) {
  const text = await readFile(new URL(`src/${name}.ts`, root), "utf8");
  await writeFile(
    new URL(`core/${name}.js`, dest),
    stripTypeScriptTypes(text, { mode: "strip" }).replace(
      /\.ts(["'])/g,
      ".js$1",
    ),
  );
}
for (const name of ["index.html", "style.css", "app.mjs"])
  await cp(new URL(`web/${name}`, root), new URL(name, dest));
await writeFile(
  new URL("example.mjs", dest),
  "export default " +
    (await readFile(new URL("examples/worked.json", root), "utf8")) +
    ";\n",
);
console.log("Built local static app in dist/; no network or publication.");
