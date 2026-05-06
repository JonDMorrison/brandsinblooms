import { useEffect, useMemo, useRef } from "react";
import type { DeviceTier } from "@/components/homepage-three/performance/useDeviceTier";
import {
  type AuthLeafParticle,
  resolveAuthParticleCount,
  spawnAuthLeafParticle,
  updateAuthLeafParticle,
} from "./authParticles";

interface AuthNanoLeafParticlesProps {
  tier: DeviceTier;
  className?: string;
}

const getViewportSize = () => ({
  width: Math.max(window.innerWidth, 1),
  height: Math.max(window.innerHeight, 1),
});

const drawLeaf = (
  context: CanvasRenderingContext2D,
  particle: AuthLeafParticle,
) => {
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.fillStyle = particle.color;
  context.beginPath();
  context.moveTo(0, -particle.size);
  context.bezierCurveTo(
    particle.size * 0.72,
    -particle.size * 0.42,
    particle.size * 0.66,
    particle.size * 0.48,
    0,
    particle.size,
  );
  context.bezierCurveTo(
    -particle.size * 0.66,
    particle.size * 0.48,
    -particle.size * 0.72,
    -particle.size * 0.42,
    0,
    -particle.size,
  );
  context.fill();
  context.restore();
};

const resizeParticlePopulation = ({
  particles,
  particleCount,
  width,
  height,
}: {
  particles: AuthLeafParticle[];
  particleCount: number;
  width: number;
  height: number;
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
      spawnAuthLeafParticle({ width, height }),
    ),
  ];
};

export const AuthNanoLeafParticles = ({
  tier,
  className = "",
}: AuthNanoLeafParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<AuthLeafParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const particleCount = useMemo(() => resolveAuthParticleCount(tier), [tier]);

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
    });
  }, [particleCount]);

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

      const lastFrameAt = lastFrameAtRef.current ?? timestamp;
      const deltaMs = Math.max(timestamp - lastFrameAt, 16.67);
      const frameScale = Math.min(deltaMs / 16.67, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      lastFrameAtRef.current = timestamp;
      context.clearRect(0, 0, width, height);
      particlesRef.current = particlesRef.current.map((particle) => {
        const nextParticle = updateAuthLeafParticle({
          particle,
          width,
          height,
          frameScale,
        });
        drawLeaf(context, nextParticle);
        return nextParticle;
      });

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
  }, [particleCount]);

  if (particleCount === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`auth-particle-canvas ${className}`.trim()}
      data-particle-count={particleCount}
      data-tier={tier}
    />
  );
};
