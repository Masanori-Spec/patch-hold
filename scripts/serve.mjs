import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url))),
  port = Number(process.env.PORT || 4173);
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
createServer(async (req, res) => {
  try {
    if (
      !allowedHosts.has(req.headers.host) ||
      !["GET", "HEAD"].includes(req.method)
    ) {
      res.writeHead(403).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".mjs": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
          }[extname(file)] || "application/octet-stream",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'none'; img-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store",
      })
      .end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`PatchHold local browser: http://127.0.0.1:${port}`),
);
