import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export interface GlassStatCardProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
  delayMs?: number;
  animate?: boolean;
  announceOnComplete?: boolean;
  finalValueLabel?: string;
  className?: string;
  isActive?: boolean;
}

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

export const GlassStatCard = ({
  value,
  label,
  suffix = "",
  decimals = 0,
  durationMs = 900,
  delayMs = 0,
  animate = true,
  announceOnComplete = false,
  finalValueLabel,
  className,
  isActive,
  ...props
}: GlassStatCardProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);

  const formatValue = (nextValue: number) =>
    `${nextValue.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    })}${suffix}`;

  useEffect(() => {
    if (hasEntered) {
      return undefined;
    }

    if (isActive) {
      setHasEntered(true);
      return undefined;
    }

    const root = rootRef.current;
    const section = root?.closest(".hp-section") as HTMLElement | null;

    if (section?.dataset.active === "true") {
      setHasEntered(true);
      return undefined;
    }

    if (section) {
      const observer = new MutationObserver(() => {
        if (section.dataset.active === "true") {
          setHasEntered(true);
          observer.disconnect();
        }
      });
      observer.observe(section, {
        attributes: true,
        attributeFilter: ["data-active"],
      });
      return () => observer.disconnect();
    }

    if (typeof IntersectionObserver === "undefined" || !root) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, [hasEntered, isActive]);

  useEffect(() => {
    if (!hasEntered) {
      setDisplayValue(0);
      setAnimationComplete(false);
      return undefined;
    }

    if (
      !animate ||
      durationMs <= 1 ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(value);
      setAnimationComplete(true);
      return undefined;
    }

    const startAnimation = () => {
      const startedAt = performance.now();

      const tick = (timestamp: number) => {
        const progress = Math.min((timestamp - startedAt) / durationMs, 1);
        setDisplayValue(value * easeOutCubic(progress));

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        setDisplayValue(value);
        setAnimationComplete(true);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    delayTimerRef.current = window.setTimeout(startAnimation, delayMs);

    return () => {
      if (delayTimerRef.current !== null) {
        window.clearTimeout(delayTimerRef.current);
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, decimals, delayMs, durationMs, hasEntered, suffix, value]);

  const displayText = formatValue(displayValue);

  return (
    <div
      ref={rootRef}
      className={joinClassNames("hp-stat-card", className)}
      data-counter-target={formatValue(value)}
      data-counter-delay-ms={delayMs}
      data-counter-duration-ms={durationMs}
      {...props}
    >
      <span className="hp-stat-card__value">{displayText}</span>
      <span className="hp-stat-card__label">{label}</span>
      {announceOnComplete ? (
        <span className="hp-stat-card__sr-value" aria-live="polite">
          {animationComplete
            ? (finalValueLabel ?? `${formatValue(value)} ${label}`)
            : ""}
        </span>
      ) : null}
    </div>
  );
};
