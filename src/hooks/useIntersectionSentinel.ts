import { useEffect, useRef } from "react";
import { createLazyLoadObserver } from "@/utils/performanceOptimizations";

export interface UseIntersectionSentinelOptions {
  enabled?: boolean;
  rootMargin?: string;
}

/**
 * Observes a DOM node and calls `onIntersect` whenever it becomes visible.
 * Defaults are tuned for "load more" behavior.
 */
export function useIntersectionSentinel(
  onIntersect: () => void,
  options: UseIntersectionSentinelOptions = {},
) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!options.enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = createLazyLoadObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) onIntersect();
    });

    // Override rootMargin if requested
    if (options.rootMargin) {
      // createLazyLoadObserver currently hardcodes rootMargin; rebuild observer.
      observer.disconnect();
      const custom = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) onIntersect();
        },
        { root: null, rootMargin: options.rootMargin, threshold: 0.1 },
      );
      custom.observe(el);
      return () => custom.disconnect();
    }

    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, options.enabled, options.rootMargin]);

  return { ref };
}
