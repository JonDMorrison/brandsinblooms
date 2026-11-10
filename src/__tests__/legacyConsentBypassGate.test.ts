import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const emailConsent = readFileSync("src/lib/crm/emailConsent.ts", "utf8");
const smsConsent = readFileSync("src/lib/crm/smsConsent.ts", "utf8");

describe("legacy consent helpers cannot bypass the atomic consent ledger", () => {
  it.each([
    ["email", emailConsent],
    ["sms", smsConsent],
  ])("routes %s staff changes through the guarded RPC", (_channel, source) => {
    const updateHelper = source.slice(
      source.indexOf("export async function updateCustomer"),
    );
    expect(updateHelper).toContain(
      'rpc(\n      "set_customer_marketing_consent_authorized"',
    );
    expect(updateHelper).not.toContain('.from("crm_customers").update');
    expect(updateHelper).not.toContain('.from("suppression_list")');
  });

  it.each([
    ["email", emailConsent],
    ["sms", smsConsent],
  ])("fails closed when %s opt-in evidence is absent", (_channel, source) => {
    expect(source).toContain("params.consentBasis");
    expect(source).toContain("params.evidence?.trim().length");
    expect(source).toContain("Opt-in requires a lawful basis");
  });
});
