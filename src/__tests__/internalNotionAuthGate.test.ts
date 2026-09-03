import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("internal Notion Edge Function authorization", () => {
  it.each(["notify-notion-trial", "update-notion-profile"])(
    "requires an internal API key in %s",
    (name) => {
      const source = read(`supabase/functions/${name}/index.ts`);
      expect(source).toContain(
        'import { requireInternalApiKey } from "../_shared/requireInternalApiKey.ts"',
      );
      expect(source).toContain("const unauthorized = requireInternalApiKey(req)");
      expect(source).toContain("if (unauthorized) return unauthorized");
    },
  );

  it("keeps opaque secret-key requests out of the JWT gateway", () => {
    const config = read("supabase/config.toml");
    for (const name of ["notify-notion-trial", "update-notion-profile"]) {
      expect(config).toContain(`[functions.${name}]\nverify_jwt = false`);
    }
  });

  it("targets gateway configuration changes instead of redeploying the fleet", () => {
    const workflow = read(".github/workflows/deploy-edge-functions.yml");
    expect(workflow).toContain("grep -v '^supabase/config.toml$'");
    expect(workflow).toContain(".gateway-config");
    expect(workflow).toContain("old_functions.get(name) != new_functions.get(name)");
  });
});
