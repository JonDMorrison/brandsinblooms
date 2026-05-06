import { useEffect, useMemo, useState } from "react";

export type HomepageLaunchVariant = "new" | "legacy";

export interface HomepageRolloutConfig {
  enabled?: boolean;
  rolloutPercent?: number;
  variant?: HomepageLaunchVariant;
}

export const HOMEPAGE_ROLLOUT_VISITOR_KEY =
  "bloomsuite.homepage.rolloutVisitorId";
export const HOMEPAGE_ROLLOUT_FETCH_TIMEOUT_MS = 800;

const DEFAULT_ROLLOUT_PERCENT = 100;

export const clampRolloutPercent = (value: unknown) => {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ROLLOUT_PERCENT;
  }

  return Math.min(Math.max(numericValue, 0), 100);
};

export const hashVisitorToBucket = (visitorId: string) => {
  let hash = 0;

  for (const character of visitorId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 10000;
  }

  return hash % 100;
};

export const resolveHomepageLaunchVariant = ({
  config,
  visitorId,
}: {
  config: HomepageRolloutConfig;
  visitorId: string;
}): HomepageLaunchVariant => {
  if (config.enabled === false || config.variant === "legacy") {
    return "legacy";
  }

  if (config.variant === "new") {
    return "new";
  }

  const rolloutPercent = clampRolloutPercent(config.rolloutPercent);
  return hashVisitorToBucket(visitorId) < rolloutPercent ? "new" : "legacy";
};

const getStoredVisitorId = () => {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existingId = window.localStorage.getItem(
      HOMEPAGE_ROLLOUT_VISITOR_KEY,
    );

    if (existingId) {
      return existingId;
    }

    const nextId =
      window.crypto?.randomUUID?.() ??
      `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(HOMEPAGE_ROLLOUT_VISITOR_KEY, nextId);
    return nextId;
  } catch {
    return "storage-unavailable";
  }
};

const getDefaultRolloutConfig = (): HomepageRolloutConfig => ({
  enabled:
    String(import.meta.env.VITE_HOMEPAGE_ENABLED ?? "true").toLowerCase() !==
    "false",
  rolloutPercent: clampRolloutPercent(
    import.meta.env.VITE_HOMEPAGE_ROLLOUT_PERCENT ?? DEFAULT_ROLLOUT_PERCENT,
  ),
  variant:
    import.meta.env.VITE_HOMEPAGE_VARIANT === "legacy" ||
    import.meta.env.VITE_HOMEPAGE_VARIANT === "new"
      ? import.meta.env.VITE_HOMEPAGE_VARIANT
      : undefined,
});

const getRolloutConfigUrl = () =>
  import.meta.env.VITE_HOMEPAGE_ROLLOUT_CONFIG_URL || "/homepage-rollout.json";

export const fetchHomepageRolloutConfig = async (
  signal: AbortSignal,
): Promise<HomepageRolloutConfig | null> => {
  const response = await fetch(getRolloutConfigUrl(), {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as HomepageRolloutConfig;
};

export const useHomepageLaunchVariant = () => {
  const visitorId = useMemo(getStoredVisitorId, []);
  const fallbackVariant = useMemo(
    () =>
      resolveHomepageLaunchVariant({
        config: getDefaultRolloutConfig(),
        visitorId,
      }),
    [visitorId],
  );
  const [variant, setVariant] = useState<HomepageLaunchVariant | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      HOMEPAGE_ROLLOUT_FETCH_TIMEOUT_MS,
    );

    fetchHomepageRolloutConfig(controller.signal)
      .then((config) => {
        if (cancelled) {
          return;
        }

        setVariant(
          resolveHomepageLaunchVariant({
            config: config ?? getDefaultRolloutConfig(),
            visitorId,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setVariant(fallbackVariant);
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeout);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [fallbackVariant, visitorId]);

  return {
    isLoading: variant === null,
    variant: variant ?? fallbackVariant,
  };
};
