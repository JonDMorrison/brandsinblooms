import { useEffect, useState, type RefObject } from "react";

interface DocScrollProgressProps {
  targetRef: RefObject<HTMLElement>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function DocScrollProgress({ targetRef }: DocScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const target = targetRef.current;
      if (!target) {
        setProgress(0);
        return;
      }

      const rect = target.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      const height = target.offsetHeight;
      const viewportHeight = window.innerHeight;
      const start = top - 120;
      const end = top + height - viewportHeight * 0.35;
      const next =
        end <= start
          ? 1
          : clamp((window.scrollY - start) / (end - start), 0, 1);
      setProgress(next);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [targetRef]);

  return (
    <div className="sticky top-0 z-20 mb-6 h-0.5 w-full overflow-hidden bg-gray-200/80">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
