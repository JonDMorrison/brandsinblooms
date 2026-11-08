// Bundles each Bloom Support Edge Function into one file for single-file
// deployment (Supabase MCP / dashboard). The CI deploy workflow deploys from
// source instead; both produce the same runtime code.
import { mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
async function loadEsbuild() {
  try {
    return await import("esbuild");
  } catch {
    const pnpm = resolve(root, "node_modules/.pnpm");
    const dir = readdirSync(pnpm).find((d) => /^esbuild@\d/.test(d));
    return await import(pathToFileURL(resolve(pnpm, dir, "node_modules/esbuild/lib/main.js")).href);
  }
}
const { build } = await loadEsbuild();
const out = process.argv[2] ?? resolve(root, "dist/bloom-support-functions");
const fns = ["bloom-support-api", "bloom-support-intake", "bloom-support-email", "bloom-support-worker", "bloom-support-mcp", "bloom-support-slack", "bloom-support-github", "bloom-support-cms-events"];
const denoSpecifiers = {
  name: "deno-specifiers",
  setup(b) {
    b.onResolve({ filter: /^(npm:|jsr:|https?:|node:)/ }, (a) => ({ path: a.path, external: true }));
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "npm:@supabase/supabase-js@2", external: true }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: resolve(root, "src", a.path.slice(2)) + (/\.[tj]sx?$/.test(a.path) ? "" : ".ts") }));
  },
};
mkdirSync(out, { recursive: true });
for (const fn of fns) {
  await build({
    entryPoints: [resolve(root, "supabase/functions", fn, "index.ts")],
    bundle: true, format: "esm", platform: "neutral", target: "es2022", outfile: resolve(out, `${fn}.js`),
    plugins: [denoSpecifiers], legalComments: "none", logLevel: "warning", mainFields: ["module", "main"],
  });
  console.log("bundled", fn);
}
