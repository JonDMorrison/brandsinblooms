import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy-edge-functions.yml"),
  "utf8",
);
const config = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
);

describe("edge deployment security gate", () => {
  it("does not globally disable JWT verification during deploys", () => {
    expect(workflow).not.toMatch(/functions deploy[^\n]*--no-verify-jwt/);
    expect(workflow).toContain('supabase functions deploy "$fn"');
    expect(workflow).toContain("supabase/config.toml");
  });

  it("declares the public email action endpoints explicitly", () => {
    expect(config).toMatch(
      /\[functions\.handle-unsubscribe\]\s*verify_jwt = false/,
    );
    expect(config).toMatch(
      /\[functions\.validate-preference-token\]\s*verify_jwt = true/,
    );
    expect(config).toMatch(
      /\[functions\.update-email-preference\]\s*verify_jwt = true/,
    );
  });
});
