import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

export type AuthAlertVariant = "error" | "success" | "info";

interface AuthAlertProps {
  variant?: AuthAlertVariant;
  children: ReactNode;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

const icons = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
};

export const AuthAlert = ({
  variant = "info",
  children,
  autoDismissMs = 8000,
  onDismiss,
}: AuthAlertProps) => {
  const [visible, setVisible] = useState(true);
  const Icon = icons[variant];

  useEffect(() => {
    if (!autoDismissMs) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);

    return () => window.clearTimeout(timerId);
  }, [autoDismissMs, onDismiss]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setVisible(false);
      onDismiss?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`auth-alert auth-alert--${variant}`}
      role="alert"
      aria-live="assertive"
    >
      <Icon aria-hidden="true" />
      <p className="auth-alert__message">{children}</p>
      <button
        type="button"
        className="auth-alert__close"
        aria-label="Dismiss message"
        onClick={() => {
          setVisible(false);
          onDismiss?.();
        }}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
};
