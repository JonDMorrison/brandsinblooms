import { useEffect } from "react";

const EXTERNAL_WIDGET_SELECTORS = [
  '[class*="elfsight"]',
  '[class*="chat-widget"]',
  '[class*="floating-widget"]',
  'iframe[src*="elfsight"]',
  'iframe[src*="chat"]',
].join(", ");

export const GlobalVisibilityManager = () => {
  useEffect(() => {
    const sweepExternalWidgets = () => {
      document.querySelectorAll(EXTERNAL_WIDGET_SELECTORS).forEach((node) => {
        node.remove();
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden/user switched away
        window.dispatchEvent(
          new CustomEvent("app:tab-hidden", {
            detail: { timestamp: Date.now() },
          }),
        );
      } else {
        // Tab is visible/user returned
        window.dispatchEvent(
          new CustomEvent("app:tab-visible", {
            detail: { timestamp: Date.now() },
          }),
        );
      }

      sweepExternalWidgets();
    };

    sweepExternalWidgets();

    const observer = new MutationObserver(() => {
      sweepExternalWidgets();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // This component renders nothing
  return null;
};
