#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAX_CHANGED_FILES = 6;
const STATUS = /^(A|M|D|T|R[0-9]{0,3}|C[0-9]{0,3})$/;
const TEST_PATH = /(^|\/)(__tests__|tests?|e2e)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/;
const REGULAR_FILE_MODES = new Set(["100644", "100755"]);

/**
 * The one canonical manifest for paths an automated repair may never change. It is used by the
 * same trusted validator in both workflow jobs. Tokens are derived from path segments (including
 * camelCase/PascalCase), so `Permissions.ts`, `RBACGuard.ts` and `price-rules.ts` cannot bypass a
 * directory-only check while unrelated words such as `Author` and `Taxonomy` remain ordinary code.
 */
export const SENSITIVE_PATH_MANIFEST = Object.freeze({
  patterns: Object.freeze([
    /^\.github(?:\/|$)/i,
    /(^|\/)migrations(?:\/|$)/i,
    /\.sql$/i,
    /^supabase\/functions(?:\/|$)/i,
    /^supabase\/config\.toml$/i,
    /(^|\/)\.env[^/]*(?:\/|$)/i,
    /(^|\/)package(?:-lock)?\.json$/i,
    /(^|\/)(?:npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lockb?)$/i,
    /(^|\/)\.git[^/]*(?:\/|$)/i,
    /(^|\/)\.(?:npmrc|yarnrc(?:\.yml)?)$/i,
    /(^|\/)(?:vercel\.json|deno(?:\.[^/]*)?\.json|docker-compose[^/]*|Dockerfile[^/]*)$/i,
    /release-policy/i,
    /(^|\/)bloom-support\/policy\.ts$/i,
    /(^|\/)CODEOWNERS$/i,
  ]),
  tokens: Object.freeze([
    "auth", "authentication", "authorization",
    "permission", "permissions", "rbac", "role", "roles", "middleware", "rls",
    "secret", "secrets", "credential", "credentials",
    "payment", "payments", "checkout", "stripe", "billing",
    "refund", "refunds", "price", "prices", "invoice", "invoices",
    "tax", "taxes", "payout", "payouts",
    "config", "configuration", "tsconfig", "dockerfile", "deploy", "deployment",
  ]),
});

const sensitiveTokens = new Set(SENSITIVE_PATH_MANIFEST.tokens);

function pathTokens(path) {
  return path.split("/").flatMap((segment) => segment
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean));
}

export class BloomRepairGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "BloomRepairGuardError";
  }
}

function splitNulls(value) {
  const fields = [];
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== 0) continue;
    fields.push(value.subarray(start, index));
    start = index + 1;
  }
  if (start !== value.length) throw new BloomRepairGuardError("Git returned an unterminated path record");
  return fields;
}

function pathText(value) {
  if (value.length === 0) throw new BloomRepairGuardError("Git returned an empty changed path");
  const text = value.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(value)) {
    throw new BloomRepairGuardError("Changed paths must be valid UTF-8");
  }
  return text;
}

/** Parse the exact NUL-delimited format emitted by `git diff --raw -z --no-abbrev`. */
export function parseRawDiff(value) {
  const fields = splitNulls(Buffer.isBuffer(value) ? value : Buffer.from(value));
  const entries = [];
  for (let index = 0; index < fields.length;) {
    const headerBytes = fields[index++];
    const header = headerBytes.toString("ascii");
    if (!Buffer.from(header, "ascii").equals(headerBytes)) {
      throw new BloomRepairGuardError("Git returned a malformed raw diff header");
    }
    const match = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) (\S+)$/.exec(header);
    if (!match) throw new BloomRepairGuardError("Git returned a malformed raw diff header");
    const [, oldMode, newMode, , , rawStatus] = match;
    if (!STATUS.test(rawStatus)) {
      throw new BloomRepairGuardError(`Unsupported git change status ${JSON.stringify(rawStatus)}`);
    }
    const kind = rawStatus[0];
    const pathCount = kind === "R" || kind === "C" ? 2 : 1;
    if (index + pathCount > fields.length) {
      throw new BloomRepairGuardError(`Incomplete git ${kind} path record`);
    }
    const paths = fields.slice(index, index + pathCount).map(pathText);
    index += pathCount;
    entries.push({ status: rawStatus, kind, paths, oldMode, newMode });
  }
  return entries;
}

const reviewOnly = (path) =>
  SENSITIVE_PATH_MANIFEST.patterns.some((pattern) => pattern.test(path)) ||
  pathTokens(path).some((token) => sensitiveTokens.has(token));

export function validateEntries(entries) {
  if (entries.length === 0) return;
  if (entries.length > MAX_CHANGED_FILES) {
    throw new BloomRepairGuardError(`Too many files for an automated repair (${entries.length}; maximum ${MAX_CHANGED_FILES})`);
  }

  let addedTests = 0;
  for (const entry of entries) {
    if (entry.kind !== "D" && !REGULAR_FILE_MODES.has(entry.newMode)) {
      const targetPath = entry.paths.at(-1);
      throw new BloomRepairGuardError(
        `Repair staged a non-regular target (mode ${entry.newMode}): ${JSON.stringify(targetPath)}`,
      );
    }
    for (const path of entry.paths) {
      if (reviewOnly(path)) {
        throw new BloomRepairGuardError(`Repair touched a review-only path: ${JSON.stringify(path)}`);
      }
      if (entry.kind !== "A" && TEST_PATH.test(path)) {
        throw new BloomRepairGuardError(`Repair modified, deleted, renamed or copied an existing test: ${JSON.stringify(path)}`);
      }
    }
    if (entry.kind === "A" && TEST_PATH.test(entry.paths[0])) addedTests++;
  }

  if (addedTests === 0) {
    throw new BloomRepairGuardError("A fix must add a new regression test");
  }
}

export function changedEntries(base, cwd = process.cwd()) {
  const result = spawnSync("git", [
    "diff", "--cached", "--raw", "-z", "--no-abbrev", "--no-ext-diff", "--no-textconv",
    "--find-renames", "--find-copies-harder", base, "--",
  ], { cwd, encoding: null, maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = Buffer.from(result.stderr ?? []).toString("utf8").trim();
    throw new BloomRepairGuardError(detail || `git diff failed with status ${result.status}`);
  }
  return parseRawDiff(Buffer.from(result.stdout ?? []));
}

function main() {
  const baseIndex = process.argv.indexOf("--base");
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
  if (!base || base.startsWith("-")) {
    throw new BloomRepairGuardError("Usage: bloom-repair-path-guard.mjs --base <trusted-revision>");
  }
  const entries = changedEntries(base);
  validateEntries(entries);
  for (const entry of entries) {
    console.log(`${entry.status} ${entry.paths.map((path) => JSON.stringify(path)).join(" -> ")}`);
  }
  console.log(`Bloom repair path guard accepted ${entries.length} changed file${entries.length === 1 ? "" : "s"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
