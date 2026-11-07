import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRawDiff,
  validateEntries,
} from "../../.github/scripts/bloom-repair-path-guard.mjs";

const guard = fileURLToPath(
  new URL("../../.github/scripts/bloom-repair-path-guard.mjs", import.meta.url),
);

function record(status, ...paths) {
  const kind = status[0];
  const oldMode = kind === "A" ? "000000" : "100644";
  const newMode = kind === "D" ? "000000" : "100644";
  const oldObject = kind === "A" ? "0".repeat(40) : "1".repeat(40);
  const newObject = kind === "D" ? "0".repeat(40) : "2".repeat(40);
  return Buffer.from(
    `:${oldMode} ${newMode} ${oldObject} ${newObject} ${status}\0${paths.join("\0")}\0`,
  );
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), "bloom-repair-guard-"));
  execFileSync("git", ["init", "-q"], { cwd });
  execFileSync("git", ["config", "user.name", "Guard test"], { cwd });
  execFileSync("git", ["config", "user.email", "guard@example.test"], { cwd });
  writeFileSync(join(cwd, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd });
  execFileSync("git", ["commit", "-qm", "base"], { cwd });
  return cwd;
}

function add(cwd, path, contents = "test\n") {
  const full = join(cwd, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
  execFileSync("git", ["add", "--", path], { cwd });
}

test("parses raw NUL records without splitting whitespace in paths", () => {
  const parsed = parseRawDiff(Buffer.concat([
    record("A", "src/a file.ts"),
    record("M", "src/a\tfile.ts"),
    record("D", "src/a\nfile.ts"),
    record("R100", "src/old name.ts", "src/new name.ts"),
  ]));
  assert.deepEqual(parsed.map((entry) => entry.paths), [
    ["src/a file.ts"],
    ["src/a\tfile.ts"],
    ["src/a\nfile.ts"],
    ["src/old name.ts", "src/new name.ts"],
  ]);
});

test("rejects sensitive paths on either side of whitespace and rename records", () => {
  for (const raw of [
    Buffer.concat([record("A", ".github/workflows/forbidden file.yml"), record("A", "tests/new.test.ts")]),
    Buffer.concat([record("A", ".github/workflows/forbidden\tfile.yml"), record("A", "tests/new.test.ts")]),
    Buffer.concat([record("A", ".github/workflows/forbidden\nfile.yml"), record("A", "tests/new.test.ts")]),
    Buffer.concat([record("R100", ".github/workflows/old.yml", "src/safe.ts"), record("A", "tests/new.test.ts")]),
  ]) {
    assert.throws(() => validateEntries(parseRawDiff(raw)), /review-only path/);
  }
});

test("requires an added regression test and no more than six changed records", () => {
  assert.throws(
    () => validateEntries(parseRawDiff(record("A", "src/fix.ts"))),
    /must add a new regression test/,
  );
  const six = [
    record("A", "tests/new.test.ts"),
    ...Array.from({ length: 5 }, (_, index) => record("A", `src/fix-${index}.ts`)),
  ];
  assert.doesNotThrow(() => validateEntries(parseRawDiff(Buffer.concat(six))));
  assert.throws(
    () => validateEntries(parseRawDiff(Buffer.concat([...six, record("A", "src/seventh.ts")]))),
    /Too many files/,
  );
});

test("real Git integration rejects a symlink target and escapes a newline path", () => {
  const cwd = repository();
  mkdirSync(join(cwd, "src"), { recursive: true });
  symlinkSync("../README.md", join(cwd, "src", "link.ts"));
  execFileSync("git", ["add", "--", "src/link.ts"], { cwd });
  add(cwd, "tests/link-regression.test.ts");
  let result = spawnSync(process.execPath, [guard, "--base", "HEAD"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-regular target \(mode 120000\)/);

  const newlineRepo = repository();
  add(newlineRepo, ".github/workflows/forbidden\nfile.yml");
  add(newlineRepo, "tests/new.test.ts");
  result = spawnSync(process.execPath, [guard, "--base", "HEAD"], {
    cwd: newlineRepo,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /review-only path/);
  assert.equal(result.stderr.slice(0, -1).includes("\n"), false);
});
