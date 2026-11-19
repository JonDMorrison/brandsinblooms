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

  // crm-r2-F01, crm-r2-F02: a function deleted from source must not stay deployed unnoticed.
  it("fails the deploy when a hosted function has no source folder", () => {
    expect(workflow).toContain("supabase functions list --project-ref \"$PROJECT_ID\"");
    expect(workflow).toContain('-f "supabase/functions/$fn/index.ts"');
    expect(workflow).toMatch(/RETAINED_HOSTED_FUNCTIONS: ""/);
    expect(workflow).toMatch(/Hosted functions missing from source[\s\S]*?exit 1/);
  });

  // crm-r2-F11: Stripe sends no Supabase JWT, so stripe-webhook must opt out of the gateway JWT check
  // and authenticate each delivery by its Stripe-Signature inside the handler.
  it("lets Stripe deliveries reach stripe-webhook, which checks the Stripe-Signature itself", () => {
    const lines = config.split("\n");
    const header = lines.findIndex((line) => line.trim() === "[functions.stripe-webhook]");
    expect(header).toBeGreaterThanOrEqual(0);
    const body: string[] = [];
    for (const line of lines.slice(header + 1)) {
      if (line.trim().startsWith("[")) break;
      body.push(line.trim());
    }
    expect(body).toContain("verify_jwt = false");
    const nearby = [...lines.slice(Math.max(0, header - 4), header), ...body].join("\n");
    expect(nearby).toMatch(/#.*Stripe-Signature/);
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
