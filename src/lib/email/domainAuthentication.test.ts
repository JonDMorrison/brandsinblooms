import { describe, expect, it } from "vitest";

import { assessDomainAuthentication } from "./domainAuthentication";

describe("domain authentication readiness", () => {
  it("requires every authentication control", () => {
    expect(
      assessDomainAuthentication({
        spf_verified: true,
        dkim_verified: true,
        return_path_verified: true,
        dmarc_verified: false,
      }),
    ).toEqual({
      ready: false,
      missing: ["DMARC"],
      message: "Authentication incomplete: DMARC.",
    });
  });

  it("fails closed when verification evidence is unavailable", () => {
    expect(assessDomainAuthentication(null).ready).toBe(false);
    expect(assessDomainAuthentication(null).missing).toEqual([
      "SPF",
      "DKIM",
      "return-path",
      "DMARC",
    ]);
  });

  it("accepts a fully authenticated domain", () => {
    expect(
      assessDomainAuthentication({
        spf_verified: true,
        dkim_verified: true,
        return_path_verified: true,
        dmarc_verified: true,
      }).ready,
    ).toBe(true);
  });
});
