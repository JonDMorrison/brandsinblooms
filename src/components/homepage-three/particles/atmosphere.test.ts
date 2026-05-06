import { describe, expect, it } from "vitest";
import {
  getLeafSizeProfile,
  getParticleColor,
  resolveParticleCount,
  spawnLeafParticle,
  updateLeafParticle,
} from "./atmosphere";

const randomSequence = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("homepage nano leaf atmosphere", () => {
  it("caps particle counts by tier and section density", () => {
    expect(resolveParticleCount("high", 1)).toBe(240);
    expect(resolveParticleCount("medium", 1)).toBe(150);
    expect(resolveParticleCount("low", 1)).toBe(65);
    expect(resolveParticleCount("fallback", 1)).toBe(0);
    expect(resolveParticleCount("medium", 0.4)).toBe(60);
    expect(resolveParticleCount("high", 2)).toBe(240);
    expect(resolveParticleCount("high", -1)).toBe(0);
  });

  it("uses the requested weighted size tiers", () => {
    const small = getLeafSizeProfile(randomSequence([0.1, 0.5, 0.5]));
    expect(small.size).toBeGreaterThanOrEqual(5);
    expect(small.size).toBeLessThanOrEqual(9);
    expect(small.opacity).toBeGreaterThanOrEqual(0.15);
    expect(small.opacity).toBeLessThanOrEqual(0.27);
    expect(small.driftSpeedMultiplier).toBe(1);
    expect(small.rotationSpeedMultiplier).toBe(1);

    const medium = getLeafSizeProfile(randomSequence([0.7, 0.5, 0.5]));
    expect(medium.size).toBeGreaterThanOrEqual(10);
    expect(medium.size).toBeLessThanOrEqual(16);
    expect(medium.opacity).toBeGreaterThanOrEqual(0.12);
    expect(medium.opacity).toBeLessThanOrEqual(0.22);
    expect(medium.driftSpeedMultiplier).toBe(0.7);
    expect(medium.rotationSpeedMultiplier).toBe(0.65);

    const large = getLeafSizeProfile(randomSequence([0.9, 0.5, 0.5]));
    expect(large.size).toBeGreaterThanOrEqual(18);
    expect(large.size).toBeLessThanOrEqual(28);
    expect(large.opacity).toBeGreaterThanOrEqual(0.06);
    expect(large.opacity).toBeLessThanOrEqual(0.14);
    expect(large.driftSpeedMultiplier).toBe(0.4);
    expect(large.rotationSpeedMultiplier).toBe(0.35);
  });

  it("spawns visible leaf particles off-screen with size-tied opacity and speed", () => {
    const particle = spawnLeafParticle({
      width: 1200,
      height: 800,
      tint: "bright",
      random: randomSequence([0, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
    });

    expect(particle.size).toBeGreaterThanOrEqual(10);
    expect(particle.size).toBeLessThanOrEqual(16);
    expect(particle.opacity).toBeGreaterThanOrEqual(0.12);
    expect(particle.opacity).toBeLessThanOrEqual(0.22);
    expect(particle.velocityY).toBeGreaterThanOrEqual(0.21);
    expect(particle.velocityY).toBeLessThanOrEqual(0.56);
    expect(particle.y).toBeLessThan(0);
  });

  it("respawns leaves after they drift past an off-screen edge", () => {
    const particle = spawnLeafParticle({
      width: 500,
      height: 400,
      tint: "sage",
      random: randomSequence([0, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
    });

    const respawned = updateLeafParticle({
      particle: { ...particle, y: 460 },
      width: 500,
      height: 400,
      frameScale: 1,
      tint: "sage",
      random: randomSequence([0, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
    });

    expect(respawned.y).toBeLessThan(0);
  });

  it("keeps tint colors semi-transparent with weighted palette picks", () => {
    expect(getParticleColor("bright", 0.2, () => 0.05)).toBe(
      "rgba(187, 247, 208, 0.200)",
    );
    expect(getParticleColor("bright", 0.18, () => 0.95)).toBe(
      "rgba(220, 252, 231, 0.180)",
    );
    expect(getParticleColor("sage", 0.12, () => 0.75)).toBe(
      "rgba(74, 222, 128, 0.120)",
    );
  });
});
