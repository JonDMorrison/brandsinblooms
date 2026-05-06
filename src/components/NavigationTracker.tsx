import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type UptraceModule = typeof import("@/utils/uptrace");

/**
 * Component that tracks navigation for Uptrace monitoring
 * Must be rendered inside Router context (within Routes)
 */
export function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    const telemetryEnabled =
      Boolean(import.meta.env.VITE_UPTRACE_DSN) &&
      String(import.meta.env.VITE_DISABLE_TELEMETRY || "").toLowerCase() !==
        "true";

    if (!telemetryEnabled) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let transaction: ReturnType<UptraceModule["startTransaction"]> = null;
    let finishTransaction: UptraceModule["endTransaction"] | null = null;

    import("@/utils/uptrace")
      .then(({ startTransaction, endTransaction }) => {
        if (cancelled) {
          return;
        }

        finishTransaction = endTransaction;
        transaction = startTransaction(
          `page.navigation.${location.pathname}`,
          "navigation",
        );

        timer = window.setTimeout(() => {
          if (transaction) {
            finishTransaction?.(transaction);
          }
        }, 100);
      })
      .catch((error) => {
        console.error("[NavigationTracker] Failed to load telemetry:", error);
      });

    return () => {
      cancelled = true;

      if (timer) {
        window.clearTimeout(timer);
      }

      if (transaction) {
        finishTransaction?.(transaction);
      }
    };
  }, [location.pathname]);

  return null; // This component doesn't render anything
}
