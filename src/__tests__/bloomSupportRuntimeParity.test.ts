import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const pnpmLock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const workflows = fs.readdirSync(path.join(root, ".github/workflows"))
  .filter((name) => name.endsWith(".yml"))
  .map((name) => ({
    name,
    body: fs.readFileSync(path.join(root, ".github/workflows", name), "utf8"),
  }));
const repair = workflows.find(({ name }) => name === "bloom-repair.yml")!.body;

describe("production and CI runtime parity", () => {
  it("pins the package contract to Vercel's Node 24 runtime", () => {
    expect(packageJson.packageManager).toBe("pnpm@10.23.0");
    expect(packageJson.engines).toEqual({ node: "24.x" });
    expect(lock.packages[""].engines).toEqual(packageJson.engines);
    expect(pnpmLock).toMatch(/^lockfileVersion: '9\.0'$/m);
    expect(fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim()).toBe("24");
  });

  it("runs every Node-based GitHub workflow on Node 24", () => {
    const setupNodeWorkflows = workflows.filter(({ body }) => body.includes("actions/setup-node"));
    expect(setupNodeWorkflows.length).toBeGreaterThan(0);
    for (const workflow of setupNodeWorkflows) {
      expect(workflow.body, workflow.name).not.toMatch(/node-version:\s*["']?22["']?/);
      expect(workflow.body, workflow.name).toMatch(/node-version:\s*["']?24["']?/);
    }
  });

  it("revalidates repairs with the trusted NUL-safe guard and resumes safely", () => {
    expect((repair.match(/bloom-repair-path-guard\.mjs" --base/g) ?? [])).toHaveLength(2);
    expect(repair).toContain('git show "$PINNED_BASE:.github/scripts/bloom-repair-path-guard.mjs"');
    expect(repair).toContain('git show "HEAD:.github/scripts/bloom-repair-path-guard.mjs"');
    expect(repair).not.toContain("awk '{print $NF}'");
    expect(repair).toContain('REMOTE_TREE=$(git rev-parse "refs/remotes/origin/$IN_BRANCH^{tree}")');
    expect(repair).toContain("The existing repair branch is not owned by this engineering issue");
    expect(repair).toContain('gh pr list --state open --base "$IN_BASE" --head "$IN_BRANCH"');
  });
});
