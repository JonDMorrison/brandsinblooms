import type { DeviceTier } from "@/components/homepage-three/performance/useDeviceTier";

export interface AuthLeafParticle {
  x: number;
  y: number;
  size: number;
  velocityY: number;
  swayAmplitude: number;
  swaySpeed: number;
  phase: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
}

export const AUTH_PARTICLE_COUNTS_BY_TIER: Record<DeviceTier, number> = {
  high: 40,
  medium: 25,
  low: 12,
  fallback: 0,
};

export const resolveAuthParticleCount = (tier: DeviceTier) =>
  AUTH_PARTICLE_COUNTS_BY_TIER[tier];

const getParticleColor = (opacity: number, random: () => number) => {
  const color = random() > 0.5 ? "134, 239, 172" : "74, 222, 128";
  return `rgba(${color}, ${opacity.toFixed(3)})`;
};

export const spawnAuthLeafParticle = ({
  width,
  height,
  random = Math.random,
}: {
  width: number;
  height: number;
  random?: () => number;
}): AuthLeafParticle => {
  const edge = Math.floor(random() * 3);
  const size = 3 + random() * 2;
  const opacity = 0.12 + random() * 0.13;
  let x = random() * width;
  let y = -(18 + random() * Math.max(height * 0.24, 80));

  if (edge === 1) {
    x = -(16 + random() * 32);
    y = random() * height;
  }

  if (edge === 2) {
    x = width + 16 + random() * 32;
    y = random() * height;
  }

  return {
    x,
    y,
    size,
    velocityY: 0.2 + random() * 0.16,
    swayAmplitude: 0.02 + random() * 0.08,
    swaySpeed: 0.004 + random() * 0.006,
    phase: random() * Math.PI * 2,
    rotation: random() * Math.PI * 2,
    rotationSpeed: ((0.3 + random() * 1.2) * Math.PI) / 180,
    color: getParticleColor(opacity, random),
  };
};

export const updateAuthLeafParticle = ({
  particle,
  width,
  height,
  frameScale,
  random = Math.random,
}: {
  particle: AuthLeafParticle;
  width: number;
  height: number;
  frameScale: number;
  random?: () => number;
}): AuthLeafParticle => {
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
    nextParticle.y > height + 40 ||
    nextParticle.x < -56 ||
    nextParticle.x > width + 56
  ) {
    return spawnAuthLeafParticle({ width, height, random });
  }

  return nextParticle;
};
