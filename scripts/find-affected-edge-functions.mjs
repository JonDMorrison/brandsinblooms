import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FUNCTION_ROOT = "supabase/functions";
const LOCAL_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"];

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function listFunctions(root) {
  const functionsRoot = resolve(root, FUNCTION_ROOT);
  return readdirSync(functionsRoot)
    .filter((name) => !name.startsWith("_"))
    .filter((name) => {
      const directory = join(functionsRoot, name);
      return statSync(directory).isDirectory() && existsSync(join(directory, "index.ts"));
    })
    .sort();
}

function extractLocalImports(source) {
  const imports = [];
  const staticPattern = /(?:from\s*|import\s*)["']([^"']+)["']/g;
  const dynamicPattern = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticPattern, dynamicPattern]) {
    let match;
    while ((match = pattern.exec(source))) imports.push(match[1]);
  }

  return imports;
}

function resolveLocalImport(root, importer, specifier) {
  let unresolved;
  if (specifier.startsWith("@/")) {
    unresolved = resolve(root, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    unresolved = resolve(dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = extname(unresolved)
    ? [unresolved]
    : [
        unresolved,
        ...LOCAL_EXTENSIONS.map((extension) => `${unresolved}${extension}`),
        ...LOCAL_EXTENSIONS.map((extension) => join(unresolved, `index${extension}`)),
      ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectDependencyPaths(root, entrypoint) {
  const visited = new Set();
  const pending = [entrypoint];

  while (pending.length) {
    const current = pending.pop();
    if (!current || visited.has(current) || !existsSync(current)) continue;
    visited.add(current);

    const source = readFileSync(current, "utf8");
    for (const specifier of extractLocalImports(source)) {
      const dependency = resolveLocalImport(root, current, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return new Set(
    [...visited].map((path) => normalizePath(relative(root, path))),
  );
}

export function findAffectedEdgeFunctions(changedPaths, root = process.cwd()) {
  const changed = new Set(changedPaths.map(normalizePath).filter(Boolean));
  const functions = listFunctions(root);

  if (
    changed.has("supabase/config.toml") ||
    changed.has(`${FUNCTION_ROOT}/deno.json`) ||
    changed.has(`${FUNCTION_ROOT}/deno.jsonc`)
  ) {
    return { deployAll: true, functions, reason: "runtime configuration changed" };
  }

  const affected = new Set();
  for (const path of changed) {
    const match = path.match(/^supabase\/functions\/([^/]+)\//);
    if (match && !match[1].startsWith("_") && functions.includes(match[1])) {
      affected.add(match[1]);
    }
  }

  for (const functionName of functions) {
    const dependencies = collectDependencyPaths(
      root,
      resolve(root, FUNCTION_ROOT, functionName, "index.ts"),
    );
    if ([...changed].some((path) => dependencies.has(path))) {
      affected.add(functionName);
    }
  }

  return {
    deployAll: false,
    functions: [...affected].sort(),
    reason: affected.size ? "affected dependency graph" : "no edge dependencies changed",
  };
}

async function runCli() {
  const input = await new Promise((resolveInput) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (value += chunk));
    process.stdin.on("end", () => resolveInput(value));
  });
  const result = findAffectedEdgeFunctions(input.split(/\r?\n/));
  process.stdout.write(`deploy_all=${result.deployAll}\n`);
  process.stdout.write(`functions=${result.functions.join(" ")}\n`);
  process.stdout.write(`reason=${result.reason}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
