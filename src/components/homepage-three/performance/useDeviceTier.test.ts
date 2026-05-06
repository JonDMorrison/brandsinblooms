import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_ANIMATION_STORAGE_KEY,
  getInitialDeviceTier,
  getNextLowerTier,
  readStoredAnimationPreference,
  writeStoredAnimationPreference,
} from "./useDeviceTier";

describe("useDeviceTier helpers", () => {
  it("falls back when motion is reduced, WebGL is unavailable, or animations are disabled", () => {
    expect(
      getInitialDeviceTier({
        reducedMotion: true,
        webglAvailable: true,
        isMobile: false,
      }),
    ).toBe("fallback");
    expect(
      getInitialDeviceTier({
        reducedMotion: false,
        webglAvailable: false,
        isMobile: false,
      }),
    ).toBe("fallback");
    expect(
      getInitialDeviceTier({
        reducedMotion: false,
        webglAvailable: true,
        isMobile: false,
        animationsDisabled: true,
      }),
    ).toBe("fallback");
  });

  it("caps mobile at medium and chooses high only for capable desktop devices", () => {
    expect(
      getInitialDeviceTier({
        reducedMotion: false,
        webglAvailable: true,
        isMobile: true,
        hardwareConcurrency: 12,
        deviceMemory: 16,
      }),
    ).toBe("medium");
    expect(
      getInitialDeviceTier({
        reducedMotion: false,
        webglAvailable: true,
        isMobile: false,
        hardwareConcurrency: 12,
        deviceMemory: 16,
      }),
    ).toBe("high");
    expect(
      getInitialDeviceTier({
        reducedMotion: false,
        webglAvailable: true,
        isMobile: false,
        hardwareConcurrency: 2,
        deviceMemory: 2,
      }),
    ).toBe("low");
  });

  it("downgrades tiers one step at a time", () => {
    expect(getNextLowerTier("high")).toBe("medium");
    expect(getNextLowerTier("medium")).toBe("low");
    expect(getNextLowerTier("low")).toBe("fallback");
    expect(getNextLowerTier("fallback")).toBe("fallback");
  });

  it("persists the disable animations preference as a boolean", () => {
    window.localStorage.removeItem(HOMEPAGE_ANIMATION_STORAGE_KEY);

    writeStoredAnimationPreference(window.localStorage, true);
    expect(readStoredAnimationPreference(window.localStorage)).toBe(true);

    writeStoredAnimationPreference(window.localStorage, false);
    expect(readStoredAnimationPreference(window.localStorage)).toBe(false);
  });
});
