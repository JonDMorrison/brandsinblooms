import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  ".github/workflows/deploy-edge-functions.yml",
  "utf8",
);

describe("edge deployment scope gate", () => {
  it("does not redeploy every function for unrelated UI or test files", () => {
    expect(workflow).not.toContain("|^src/'; then");
    expect(workflow).toContain("^src/(lib/studio/");
    expect(workflow).toContain("hooks/useCompanyInfo\\.ts$");
    expect(workflow).toContain("integrations/supabase/types\\.ts$");
  });

  it("still deploys the directly changed function directory", () => {
    expect(workflow).toContain("grep -oP '^supabase/functions/\\K[^/]+'");
    expect(workflow).toContain('[[ -d "supabase/functions/$fn" ]]');
  });
});
