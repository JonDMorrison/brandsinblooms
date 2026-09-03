import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  ".github/workflows/deploy-edge-functions.yml",
  "utf8",
);

describe("edge deployment scope gate", () => {
  it("does not redeploy every function for unrelated UI or test files", () => {
    expect(workflow).not.toContain("|^src/'; then");
    expect(workflow).toContain("scripts/find-affected-edge-functions.mjs");
    expect(workflow).toContain('elif [[ -z "$functions" ]]');
    expect(workflow).toContain("Nothing to deploy");
  });

  it("still deploys the directly changed function directory", () => {
    expect(workflow).toContain("steps.changed.outputs.functions");
    expect(workflow).toContain("for fn in $functions");
    expect(workflow).toContain('supabase functions deploy "$fn"');
  });
});
