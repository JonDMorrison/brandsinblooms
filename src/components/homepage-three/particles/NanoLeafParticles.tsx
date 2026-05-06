import { useEffect, useMemo, useRef } from "react";
import type { DeviceTier } from "../performance/useDeviceTier";
import {
  type LeafParticle,
  type ParticleTint,
  resolveParticleCount,
  spawnLeafParticle,
  updateLeafParticle,
} from "./atmosphere";

interface NanoLeafParticlesProps {
  tier: DeviceTier;
  densityMultiplier: number;
  tint: ParticleTint;
  reportFrame?: (fps: number, timestamp?: number) => void;
  className?: string;
}

const drawLeaf = (
  context: CanvasRenderingContext2D,
  particle: LeafParticle,
) => {
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.fillStyle = particle.color;
  context.beginPath();
  context.moveTo(0, -particle.size);
  context.bezierCurveTo(
    particle.size * 0.75,
    -particle.size * 0.45,
    particle.size * 0.7,
    particle.size * 0.5,
    0,
    particle.size,
  );
  context.bezierCurveTo(
    -particle.size * 0.7,
    particle.size * 0.5,
    -particle.size * 0.75,
    -particle.size * 0.45,
    0,
    -particle.size,
  );
  context.fill();
  context.restore();
};

const getViewportSize = () => ({
  width: Math.max(window.innerWidth, 1),
  height: Math.max(window.innerHeight, 1),
});

const resizeParticlePopulation = ({
  particles,
  particleCount,
  width,
  height,
  tint,
}: {
  particles: LeafParticle[];
  particleCount: number;
  width: number;
  height: number;
  tint: ParticleTint;
}) => {
  if (particles.length === particleCount) {
    return particles;
  }

  if (particles.length > particleCount) {
    return particles.slice(0, particleCount);
  }

  return [
    ...particles,
    ...Array.from({ length: particleCount - particles.length }, () =>
      spawnLeafParticle({ width, height, tint }),
    ),
  ];
};

export const NanoLeafParticles = ({
  tier,
  densityMultiplier,
  tint,
  reportFrame,
  className = "",
}: NanoLeafParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<LeafParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const particleCount = useMemo(
    () => resolveParticleCount(tier, densityMultiplier),
    [densityMultiplier, tier],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const syncCanvasSize = () => {
      const isJsdom = window.navigator.userAgent
        .toLowerCase()
        .includes("jsdom");
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = getViewportSize();

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (!isJsdom) {
        const context = canvas.getContext("2d");
        context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    };

    syncCanvasSize();
    window.addEventListener("resize", syncCanvasSize);

    return () => window.removeEventListener("resize", syncCanvasSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || particleCount === 0) {
      particlesRef.current = [];
      return;
    }

    const { width, height } = getViewportSize();
    particlesRef.current = resizeParticlePopulation({
      particles: particlesRef.current,
      particleCount,
      width,
      height,
      tint,
    });
  }, [particleCount, tint]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || particleCount === 0) {
      return undefined;
    }

    if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    let cancelled = false;

    const animate = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const frameStartedAt = performance.now();
      const lastFrameAt = lastFrameAtRef.current ?? timestamp;
      const deltaMs = Math.max(timestamp - lastFrameAt, 16.67);
      const frameScale = Math.min(deltaMs / 16.67, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      lastFrameAtRef.current = timestamp;
      context.clearRect(0, 0, width, height);
      particlesRef.current = particlesRef.current.map((particle) => {
        const nextParticle = updateLeafParticle({
          particle,
          width,
          height,
          frameScale,
          tint,
        });
        drawLeaf(context, nextParticle);
        return nextParticle;
      });

      const frameDuration = performance.now() - frameStartedAt;
      const fps = 1000 / deltaMs;

      if (frameDuration < 1.5 || particleCount <= 50) {
        reportFrame?.(fps, timestamp);
      } else {
        reportFrame?.(Math.min(fps, 49), timestamp);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      lastFrameAtRef.current = null;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [particleCount, reportFrame, tint]);

  if (particleCount === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`hp-particle-canvas ${className}`.trim()}
      data-particle-count={particleCount}
      data-tier={tier}
      data-tint={tint}
    />
  );
};
