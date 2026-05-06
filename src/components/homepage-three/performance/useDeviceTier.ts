import { useCallback, useEffect, useRef, useState } from "react";

export type DeviceTier = "high" | "medium" | "low" | "fallback";

export const HOMEPAGE_ANIMATION_STORAGE_KEY =
  "bloomsuite.homepage.animationsDisabled";

export interface DeviceTierEnvironment {
  reducedMotion: boolean;
  webglAvailable: boolean;
  isMobile: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  animationsDisabled?: boolean;
}

export interface DeviceTierState {
  tier: DeviceTier;
  animationsDisabled: boolean;
  setAnimationsDisabled: (disabled: boolean) => void;
  reportFrame: (fps: number, timestamp?: number) => void;
}

const LOW_FPS_THRESHOLD = 50;
const LOW_FPS_DURATION_MS = 2000;

export const getNextLowerTier = (tier: DeviceTier): DeviceTier => {
  if (tier === "high") {
    return "medium";
  }
  if (tier === "medium") {
    return "low";
  }
  if (tier === "low") {
    return "fallback";
  }

  return "fallback";
};

export const getInitialDeviceTier = ({
  reducedMotion,
  webglAvailable,
  isMobile,
  hardwareConcurrency = 4,
  deviceMemory = 4,
  animationsDisabled = false,
}: DeviceTierEnvironment): DeviceTier => {
  if (animationsDisabled || reducedMotion || !webglAvailable) {
    return "fallback";
  }

  if (isMobile) {
    return hardwareConcurrency <= 4 || deviceMemory <= 3 ? "low" : "medium";
  }

  if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
    return "high";
  }

  if (hardwareConcurrency <= 4 || deviceMemory <= 3) {
    return "low";
  }

  return "medium";
};

export const readStoredAnimationPreference = (storage: Storage | null) => {
  if (!storage) {
    return false;
  }

  try {
    return storage.getItem(HOMEPAGE_ANIMATION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeStoredAnimationPreference = (
  storage: Storage | null,
  disabled: boolean,
) => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      HOMEPAGE_ANIMATION_STORAGE_KEY,
      disabled ? "true" : "false",
    );
  } catch {
    // Storage can be unavailable in private contexts.
  }
};

export const detectWebGLSupport = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
};

const getBrowserEnvironment = (animationsDisabled: boolean) => {
  if (typeof window === "undefined") {
    return {
      reducedMotion: true,
      webglAvailable: false,
      isMobile: false,
      hardwareConcurrency: 4,
      deviceMemory: 4,
      animationsDisabled,
    } satisfies DeviceTierEnvironment;
  }

  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const isMobile =
    (window.matchMedia?.("(max-width: 767px)").matches ?? false) ||
    window.navigator.maxTouchPoints > 1;
  const navigatorWithMemory = window.navigator as Navigator & {
    deviceMemory?: number;
  };

  return {
    reducedMotion,
    webglAvailable: detectWebGLSupport(),
    isMobile,
    hardwareConcurrency: window.navigator.hardwareConcurrency ?? 4,
    deviceMemory: navigatorWithMemory.deviceMemory ?? 4,
    animationsDisabled,
  } satisfies DeviceTierEnvironment;
};

export const useDeviceTier = (): DeviceTierState => {
  const [animationsDisabled, setAnimationsDisabledState] = useState(() =>
    typeof window === "undefined"
      ? false
      : readStoredAnimationPreference(window.localStorage),
  );
  const [tier, setTier] = useState<DeviceTier>(() =>
    getInitialDeviceTier(getBrowserEnvironment(animationsDisabled)),
  );
  const lowFpsStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setTier(getInitialDeviceTier(getBrowserEnvironment(animationsDisabled)));
    lowFpsStartedAtRef.current = null;
  }, [animationsDisabled]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const updateTier = () =>
      setTier(getInitialDeviceTier(getBrowserEnvironment(animationsDisabled)));

    reducedMotionQuery.addEventListener?.("change", updateTier);
    mobileQuery.addEventListener?.("change", updateTier);

    return () => {
      reducedMotionQuery.removeEventListener?.("change", updateTier);
      mobileQuery.removeEventListener?.("change", updateTier);
    };
  }, [animationsDisabled]);

  const setAnimationsDisabled = useCallback((disabled: boolean) => {
    writeStoredAnimationPreference(
      typeof window === "undefined" ? null : window.localStorage,
      disabled,
    );
    setAnimationsDisabledState(disabled);
    setTier(getInitialDeviceTier(getBrowserEnvironment(disabled)));
  }, []);

  const reportFrame = useCallback(
    (fps: number, timestamp = performance.now()) => {
      if (fps >= LOW_FPS_THRESHOLD) {
        lowFpsStartedAtRef.current = null;
        return;
      }

      if (lowFpsStartedAtRef.current === null) {
        lowFpsStartedAtRef.current = timestamp;
        return;
      }

      if (timestamp - lowFpsStartedAtRef.current < LOW_FPS_DURATION_MS) {
        return;
      }

      lowFpsStartedAtRef.current = timestamp;
      setTier((currentTier) => getNextLowerTier(currentTier));
    },
    [],
  );

  return {
    tier: animationsDisabled ? "fallback" : tier,
    animationsDisabled,
    setAnimationsDisabled,
    reportFrame,
  };
};
