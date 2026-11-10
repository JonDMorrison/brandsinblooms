import { describe, expect, it } from "vitest";

import { getSafeOAuthReturnTo } from "@/utils/authReturnTo";

const ORIGIN = "https://bloomsuite.app";

describe("getSafeOAuthReturnTo", () => {
  it("allows the Lightspeed partner connect deep link", () => {
    expect(
      getSafeOAuthReturnTo(
        "/integrations/lightspeed/connect?source=lightspeed-app-store",
        ORIGIN,
      ),
    ).toBe(
      "/integrations/lightspeed/connect?source=lightspeed-app-store",
    );
  });

  it("continues to allow first-party OAuth routes", () => {
    expect(getSafeOAuthReturnTo("/oauth/authorize?state=abc", ORIGIN)).toBe(
      "/oauth/authorize?state=abc",
    );
  });

  it("rejects unrelated and cross-origin destinations", () => {
    expect(getSafeOAuthReturnTo("/dashboard", ORIGIN)).toBeNull();
    expect(
      getSafeOAuthReturnTo(
        "https://example.com/integrations/lightspeed/connect",
        ORIGIN,
      ),
    ).toBeNull();
  });
});
