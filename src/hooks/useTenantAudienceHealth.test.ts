import { describe, expect, it } from "vitest";
import { hasUsableCampaignEmail } from "./useTenantAudienceHealth";

describe("campaign audience email readiness", () => {
  it("rejects missing and reserved IdealPOS placeholder emails", () => {
    expect(hasUsableCampaignEmail(null)).toBe(false);
    expect(hasUsableCampaignEmail("")).toBe(false);
    expect(hasUsableCampaignEmail("000012@noemail.local")).toBe(false);
    expect(hasUsableCampaignEmail("000012@NOEMAIL.LOCAL")).toBe(false);
  });

  it("rejects malformed addresses and permits ordinary mixed-case emails", () => {
    expect(hasUsableCampaignEmail("not-an-email")).toBe(false);
    expect(hasUsableCampaignEmail("bad @example.com")).toBe(false);
    expect(hasUsableCampaignEmail(" bryan@gardencentre.ca ")).toBe(true);
    expect(hasUsableCampaignEmail("Bryan@Example.CA")).toBe(true);
  });

  it("rejects reserved demo and test domains, like the send path", () => {
    expect(hasUsableCampaignEmail("jane@greenfield-demo.example.invalid")).toBe(false);
    expect(hasUsableCampaignEmail("bryan@example.com")).toBe(false);
    expect(hasUsableCampaignEmail("a@mail.example.org")).toBe(false);
    expect(hasUsableCampaignEmail("a@shop.test")).toBe(false);
    expect(hasUsableCampaignEmail("a@testing.ca")).toBe(true);
  });
});
