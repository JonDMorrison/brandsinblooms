import { describe, expect, it } from "vitest";
import { resolveTenantTimezone } from "./tenantTimezone";

describe("tenant time zone for new locations", () => {
  it("prefers the tenant setting", () => {
    expect(
      resolveTenantTimezone({
        tenantSettings: { timezone: "America/Vancouver" },
        locationTimezones: ["America/Toronto"],
        browserTimezone: "Europe/London",
      }),
    ).toBe("America/Vancouver");
  });

  it("falls back to an existing location, then the browser", () => {
    expect(
      resolveTenantTimezone({ tenantSettings: {}, locationTimezones: ["America/Edmonton"], browserTimezone: "Europe/London" }),
    ).toBe("America/Edmonton");
    expect(
      resolveTenantTimezone({ tenantSettings: { timezone: "Not/AZone" }, locationTimezones: [], browserTimezone: "Europe/London" }),
    ).toBe("Europe/London");
  });
});
