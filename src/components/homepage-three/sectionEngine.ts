import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TransitionType =
  | "dissolve"
  | "slide-up"
  | "scale-fade"
  | "crossfade-hold";

export type TransitionDirection = "forward" | "backward" | "none";

export type SectionInputKind =
  | "wheel"
  | "touch"
  | "keyboard"
  | "progress"
  | "nav"
  | "history"
  | "programmatic";

export interface TransitionPairConfig {
  from: number;
  to: number;
  type: TransitionType;
  durationMs?: number;
}

export interface ResolvedTransitionConfig {
  type: TransitionType;
  durationMs: number;
}

export interface SectionEngineSnapshot {
  currentSection: number;
  previousSection: number | null;
  transitionProgress: number;
  transitionDirection: TransitionDirection;
  isTransitioning: boolean;
  activeTransition: TransitionType;
  transitionDurationMs: number;
  inputKind: SectionInputKind;
}

export interface SectionEngineOptions {
  sectionCount: number;
  initialSection?: number;
  defaultDurationMs?: number;
  transitionPairs?: TransitionPairConfig[];
}

export interface SectionNavigationOptions {
  inputKind?: SectionInputKind;
  speedMultiplier?: number;
  force?: boolean;
}

export interface SectionEngineApi extends SectionEngineSnapshot {
  advance: (options?: SectionNavigationOptions) => boolean;
  retreat: (options?: SectionNavigationOptions) => boolean;
  goTo: (sectionIndex: number, options?: SectionNavigationOptions) => boolean;
}

const DEFAULT_DURATION_MS = 700;
const TRANSITION_ACCEPTANCE_PROGRESS = 0.7;

export const clampSectionIndex = (
  sectionIndex: number,
  sectionCount: number,
) => {
  if (sectionCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(sectionIndex, 0), sectionCount - 1);
};

export const normalizeHashSlug = (hash: string) => {
  const rawSlug = hash.trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9-]+$/.test(rawSlug) ? rawSlug : "";
};

export const getSectionIndexFromHash = (
  hash: string,
  sectionSlugs: string[],
) => {
  const safeSlug = normalizeHashSlug(hash);

  if (!safeSlug) {
    return null;
  }

  const sectionIndex = sectionSlugs.indexOf(safeSlug);
  return sectionIndex >= 0 ? sectionIndex : null;
};

export const getHashForSectionSlug = (slug: string) => `#${slug}`;

export const resolveTransitionForPair = ({
  from,
  to,
  transitionPairs = [],
  defaultDurationMs = DEFAULT_DURATION_MS,
}: {
  from: number;
  to: number;
  transitionPairs?: TransitionPairConfig[];
  defaultDurationMs?: number;
}): ResolvedTransitionConfig => {
  const configuredPair =
    transitionPairs.find((pair) => pair.from === from && pair.to === to) ??
    transitionPairs.find((pair) => pair.from === to && pair.to === from);

  return {
    type: configuredPair?.type ?? "slide-up",
    durationMs: configuredPair?.durationMs ?? defaultDurationMs,
  };
};

const getInitialSnapshot = ({
  initialSection = 0,
  sectionCount,
  defaultDurationMs = DEFAULT_DURATION_MS,
  transitionPairs = [],
}: SectionEngineOptions): SectionEngineSnapshot => {
  const currentSection = clampSectionIndex(initialSection, sectionCount);
  const initialTransition = resolveTransitionForPair({
    from: currentSection,
    to: Math.min(currentSection + 1, Math.max(sectionCount - 1, 0)),
    transitionPairs,
    defaultDurationMs,
  });

  return {
    currentSection,
    previousSection: null,
    transitionProgress: 1,
    transitionDirection: "none",
    isTransitioning: false,
    activeTransition: initialTransition.type,
    transitionDurationMs: initialTransition.durationMs,
    inputKind: "programmatic",
  };
};

const canStartTransition = (snapshot: SectionEngineSnapshot) =>
  !snapshot.isTransitioning ||
  snapshot.transitionProgress >= TRANSITION_ACCEPTANCE_PROGRESS;

export const useSectionEngine = ({
  sectionCount,
  initialSection = 0,
  defaultDurationMs = DEFAULT_DURATION_MS,
  transitionPairs = [],
}: SectionEngineOptions): SectionEngineApi => {
  const [snapshot, setSnapshot] = useState<SectionEngineSnapshot>(() =>
    getInitialSnapshot({
      sectionCount,
      initialSection,
      defaultDurationMs,
      transitionPairs,
    }),
  );
  const snapshotRef = useRef(snapshot);
  const animationFrameRef = useRef<number | null>(null);
  const transitionPairsRef = useRef(transitionPairs);

  useEffect(() => {
    transitionPairsRef.current = transitionPairs;
  }, [transitionPairs]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const commitSnapshot = useCallback((nextSnapshot: SectionEngineSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const goTo = useCallback(
    (sectionIndex: number, options: SectionNavigationOptions = {}) => {
      if (sectionIndex < 0 || sectionIndex >= sectionCount) {
        return false;
      }

      const currentSnapshot = snapshotRef.current;

      if (sectionIndex === currentSnapshot.currentSection) {
        return false;
      }

      if (!options.force && !canStartTransition(currentSnapshot)) {
        return false;
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const transitionDirection: TransitionDirection =
        sectionIndex > currentSnapshot.currentSection ? "forward" : "backward";
      const resolvedTransition = resolveTransitionForPair({
        from: currentSnapshot.currentSection,
        to: sectionIndex,
        transitionPairs: transitionPairsRef.current,
        defaultDurationMs,
      });
      const speedMultiplier = Math.max(options.speedMultiplier ?? 1, 0.1);
      const transitionDurationMs = Math.max(
        1,
        resolvedTransition.durationMs / speedMultiplier,
      );
      const startedAt = performance.now();
      const startingSnapshot: SectionEngineSnapshot = {
        currentSection: sectionIndex,
        previousSection: currentSnapshot.currentSection,
        transitionProgress: 0,
        transitionDirection,
        isTransitioning: true,
        activeTransition: resolvedTransition.type,
        transitionDurationMs,
        inputKind: options.inputKind ?? "programmatic",
      };

      commitSnapshot(startingSnapshot);

      const tick = (timestamp: number) => {
        const transitionProgress = Math.min(
          Math.max((timestamp - startedAt) / transitionDurationMs, 0),
          1,
        );
        const nextSnapshot: SectionEngineSnapshot = {
          ...snapshotRef.current,
          transitionProgress,
        };

        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);

        if (transitionProgress < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        const completedSnapshot: SectionEngineSnapshot = {
          ...nextSnapshot,
          previousSection: null,
          transitionProgress: 1,
          transitionDirection: "none",
          isTransitioning: false,
        };

        animationFrameRef.current = null;
        commitSnapshot(completedSnapshot);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
      return true;
    },
    [commitSnapshot, defaultDurationMs, sectionCount],
  );

  const advance = useCallback(
    (options?: SectionNavigationOptions) =>
      goTo(snapshotRef.current.currentSection + 1, options),
    [goTo],
  );

  const retreat = useCallback(
    (options?: SectionNavigationOptions) =>
      goTo(snapshotRef.current.currentSection - 1, options),
    [goTo],
  );

  return useMemo(
    () => ({
      ...snapshot,
      advance,
      retreat,
      goTo,
    }),
    [advance, goTo, retreat, snapshot],
  );
};
