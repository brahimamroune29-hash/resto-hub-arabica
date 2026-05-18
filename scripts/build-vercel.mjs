/**
 * Post-build script: converts TanStack Start output to Vercel Build Output API v3.
 * Run after `vite build`. Creates .vercel/output/ from dist/.
 */
import { build } from "esbuild";
import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".vercel", "output");
const funcDir = path.join(outDir, "functions", "index.func");

// Clean previous output
if (existsSync(outDir)) await rm(outDir, { recursive: true });

await mkdir(path.join(outDir, "static"), { recursive: true });
await mkdir(funcDir, { recursive: true });

// 1. Copy static client assets
await cp(path.join(root, "dist", "client"), path.join(outDir, "static"), {
  recursive: true,
});
console.log("✓ Copied static assets");

// 2. Bundle the TanStack Start server + Node.js handler into a single file
const serverPath = path.join(root, "dist", "server", "server.js");
const handlerEntry = `
import { NodeRequest, sendNodeResponse } from "srvx/node";
import server from ${JSON.stringify(serverPath)};

export default async function handler(req, res) {
  const webReq = new NodeRequest({ req, res });
  try {
    const webRes = await server.fetch(webReq);
    await sendNodeResponse(res, webRes);
  } catch (err) {
    console.error("[vercel-handler] error", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
}
`;

const entryFile = path.join(funcDir, "_entry.mjs");
await writeFile(entryFile, handlerEntry);

await build({
  entryPoints: [entryFile],
  outfile: path.join(funcDir, "index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: [],
  // Bundle everything except node: builtins
  conditions: ["node", "import", "require"],
  mainFields: ["main", "module"],
  logLevel: "warning",
  resolveExtensions: [".mjs", ".js", ".ts", ".json"],
  ignoreAnnotations: true,
});

// Clean up temp entry
await rm(entryFile);

// 3. Vercel function config
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.js",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    },
    null,
    2
  )
);

// 4. Vercel output config — static first, everything else → SSR function
await writeFile(
  path.join(outDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "^/assets/(.*)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        {
          handle: "filesystem",
        },
        {
          src: "/(.*)",
          dest: "/index",
        },
      ],
    },
    null,
    2
  )
);

console.log("✓ Vercel Build Output API v3 ready at .vercel/output/");
