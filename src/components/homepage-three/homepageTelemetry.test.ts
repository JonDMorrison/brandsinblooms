import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY,
  isHomepageAnalyticsConsentGranted,
  trackHomepageEvent,
} from "./homepageTelemetry";

describe("homepageTelemetry", () => {
  afterEach(() => {
    window.localStorage.removeItem(HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY);
    delete window.__BLOOMSUITE_ANALYTICS_CONSENT__;
    delete window.dataLayer;
    vi.restoreAllMocks();
  });

  it("does not emit homepage analytics before consent", () => {
    expect(isHomepageAnalyticsConsentGranted()).toBe(false);
    expect(trackHomepageEvent("page_view", { section: "hero" })).toBe(false);
    expect(window.dataLayer).toBeUndefined();
  });

  it("emits sanitized homepage analytics after stored consent", () => {
    const listener = vi.fn();
    window.addEventListener("bloomsuite:homepage-analytics", listener);
    window.localStorage.setItem(
      HOMEPAGE_ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );

    expect(
      trackHomepageEvent("cta_click", {
        label: "Start Free Trial",
        href: "/auth",
        section: "hero",
      }),
    ).toBe(true);

    expect(window.dataLayer).toEqual([
      expect.objectContaining({
        event: "homepage_cta_click",
        label: "Start Free Trial",
        href: "/auth",
        section: "hero",
      }),
    ]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ event: "homepage_cta_click" }),
      }),
    );

    window.removeEventListener("bloomsuite:homepage-analytics", listener);
  });
});
