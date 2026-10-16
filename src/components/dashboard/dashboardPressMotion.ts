import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Give the user time to see the button depress before changing routes.
 * Keep this scoped to dashboard navigation, not every button in the app.
 */
export const DASHBOARD_PRESS_DURATION_MS = 190;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedDashboardMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

export function useDashboardPressNavigation() {
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const open = useCallback(
    (actionId: string, destination: string) => {
      // A tap can yield multiple click events on some touch input devices.
      if (locked.current) return;
      locked.current = true;

      if (prefersReducedDashboardMotion()) {
        navigate(destination);
        return;
      }

      setActiveAction(actionId);
      timer.current = setTimeout(() => {
        timer.current = null;
        navigate(destination);
      }, DASHBOARD_PRESS_DURATION_MS);
    },
    [navigate],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      // The component is unmounting; never navigate from an abandoned tap.
    },
    [],
  );

  return { open, activeAction };
}

/**
 * A tactile press, followed by an intentional route change.
 * Motion settings are honoured on desktop, touchscreen and keyboard.
 */
export const dashboardPressSx = {
  position: "relative" as const,
  transform: "translateZ(0)",
  transformOrigin: "center center",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  transition:
    "transform 165ms cubic-bezier(.2,.85,.25,1), box-shadow 165ms ease, border-color 165ms ease, background-color 165ms ease, filter 165ms ease",
  "@media (hover: hover) and (pointer: fine)": {
    "&:hover:not([data-activating='true'])": {
      transform: "translateY(-2px) scale(1.006)",
      boxShadow: "0 8px 18px rgba(28,36,48,.10)",
    },
  },
  "&:active, &[data-activating='true']": {
    transform: "translateY(3px) scale(.965)",
    boxShadow:
      "inset 0 3px 7px rgba(23,30,41,.18), 0 1px 2px rgba(23,30,41,.06)",
    filter: "brightness(.975)",
  },
  "& [data-dashboard-action-icon], & [data-dashboard-action-arrow]": {
    transition: "transform 165ms cubic-bezier(.2,.85,.25,1)",
  },
  "&[data-activating='true'] [data-dashboard-action-icon]": {
    transform: "translateY(2px) scale(.93)",
  },
  "&[data-activating='true'] [data-dashboard-action-arrow]": {
    transform: "translateX(6px)",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&, &:active, &[data-activating='true']": {
      transform: "none",
      filter: "none",
      boxShadow: "none",
    },
    "& [data-dashboard-action-icon], & [data-dashboard-action-arrow]": {
      transition: "none",
      transform: "none",
    },
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover": { transform: "none" },
    },
  },
} as const;
