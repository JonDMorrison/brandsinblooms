import type { DeviceTier } from "../performance/useDeviceTier";

export type ParticleTint = "bright" | "sage" | "muted" | "none";

export interface LeafParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocityY: number;
  swayAmplitude: number;
  swaySpeed: number;
  phase: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
}

export const PARTICLE_COUNTS_BY_TIER: Record<DeviceTier, number> = {
  high: 240,
  medium: 150,
  low: 65,
  fallback: 0,
};

export interface LeafSizeProfile {
  size: number;
  opacity: number;
  driftSpeedMultiplier: number;
  rotationSpeedMultiplier: number;
}

export const clampDensityMultiplier = (densityMultiplier: number) =>
  Math.min(Math.max(densityMultiplier, 0), 1);

export const getParticleCountForTier = (tier: DeviceTier) =>
  PARTICLE_COUNTS_BY_TIER[tier];

export const resolveParticleCount = (
  tier: DeviceTier,
  densityMultiplier: number,
) =>
  Math.floor(
    getParticleCountForTier(tier) * clampDensityMultiplier(densityMultiplier),
  );

const tintColorStops: Record<
  ParticleTint,
  Array<{ color: string; weight: number }>
> = {
  bright: [
    { color: "187, 247, 208", weight: 0.4 },
    { color: "134, 239, 172", weight: 0.3 },
    { color: "74, 222, 128", weight: 0.1 },
    { color: "220, 252, 231", weight: 0.2 },
  ],
  sage: [
    { color: "187, 247, 208", weight: 0.4 },
    { color: "134, 239, 172", weight: 0.3 },
    { color: "74, 222, 128", weight: 0.1 },
    { color: "220, 252, 231", weight: 0.2 },
  ],
  muted: [
    { color: "187, 247, 208", weight: 0.4 },
    { color: "134, 239, 172", weight: 0.3 },
    { color: "74, 222, 128", weight: 0.1 },
    { color: "220, 252, 231", weight: 0.2 },
  ],
  none: [{ color: "187, 247, 208", weight: 1 }],
};

export const getLeafSizeProfile = (random: () => number): LeafSizeProfile => {
  const roll = random();

  if (roll < 0.55) {
    return {
      size: 5 + random() * 4,
      opacity: 0.15 + random() * 0.12,
      driftSpeedMultiplier: 1,
      rotationSpeedMultiplier: 1,
    };
  }

  if (roll < 0.85) {
    return {
      size: 10 + random() * 6,
      opacity: 0.12 + random() * 0.1,
      driftSpeedMultiplier: 0.7,
      rotationSpeedMultiplier: 0.65,
    };
  }

  return {
    size: 18 + random() * 10,
    opacity: 0.06 + random() * 0.08,
    driftSpeedMultiplier: 0.4,
    rotationSpeedMultiplier: 0.35,
  };
};

export const getParticleColor = (
  tint: ParticleTint,
  opacity: number,
  random: () => number,
) => {
  const colorStops = tintColorStops[tint] ?? tintColorStops.bright;
  const roll = random();
  let cumulativeWeight = 0;

  for (const colorStop of colorStops) {
    cumulativeWeight += colorStop.weight;

    if (roll <= cumulativeWeight) {
      return `rgba(${colorStop.color}, ${opacity.toFixed(3)})`;
    }
  }

  return `rgba(${colorStops[colorStops.length - 1].color}, ${opacity.toFixed(3)})`;
};

export const spawnLeafParticle = ({
  width,
  height,
  tint,
  random = Math.random,
}: {
  width: number;
  height: number;
  tint: ParticleTint;
  random?: () => number;
}): LeafParticle => {
  const edge = Math.floor(random() * 3);
  const leafSizeProfile = getLeafSizeProfile(random);
  let x = random() * width;
  let y = -(12 + random() * Math.max(height * 0.32, 80));

  if (edge === 1) {
    x = -(12 + random() * 28);
    y = random() * height;
  }

  if (edge === 2) {
    x = width + 12 + random() * 28;
    y = random() * height;
  }

  return {
    x,
    y,
    size: leafSizeProfile.size,
    opacity: leafSizeProfile.opacity,
    velocityY: (0.3 + random() * 0.5) * leafSizeProfile.driftSpeedMultiplier,
    swayAmplitude: 0.04 + random() * 0.18,
    swaySpeed: 0.008 + random() * 0.012,
    phase: random() * Math.PI * 2,
    rotation: random() * Math.PI * 2,
    rotationSpeed:
      (((0.5 + random() * 1.5) * Math.PI) / 180) *
      leafSizeProfile.rotationSpeedMultiplier,
    color: getParticleColor(tint, leafSizeProfile.opacity, random),
  };
};

export const updateLeafParticle = ({
  particle,
  width,
  height,
  frameScale,
  tint,
  random = Math.random,
}: {
  particle: LeafParticle;
  width: number;
  height: number;
  frameScale: number;
  tint: ParticleTint;
  random?: () => number;
}) => {
  const nextParticle = {
    ...particle,
    y: particle.y + particle.velocityY * frameScale,
    x:
      particle.x +
      Math.sin(particle.phase + particle.y * particle.swaySpeed) *
        particle.swayAmplitude *
        frameScale,
    rotation: particle.rotation + particle.rotationSpeed * frameScale,
  };

  if (
    nextParticle.y > height + 32 ||
    nextParticle.x < -48 ||
    nextParticle.x > width + 48
  ) {
    return spawnLeafParticle({ width, height, tint, random });
  }

  return nextParticle;
};
