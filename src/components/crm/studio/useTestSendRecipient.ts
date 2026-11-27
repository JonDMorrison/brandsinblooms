import * as React from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_PREFIX = "bloomsuite.studio.test-recipient";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the address looks like a single email address. */
export function isValidTestRecipient(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function storageKey(userId: string | undefined) {
  return `${STORAGE_PREFIX}.${userId ?? "anonymous"}`;
}

function readLastRecipient(userId: string | undefined): string | null {
  try {
    const stored = window.sessionStorage.getItem(storageKey(userId));
    return stored && isValidTestRecipient(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * The recipient a test send starts with: the address last used for a test
 * in this browser session, or else the signed-in user's own email. Shared by
 * every way into the Preview & Test dialog (campaign editor and Studio).
 */
export function useTestSendRecipient() {
  const { user } = useAuth();
  const userId = user?.id;
  const userEmail = user?.email ?? "";

  const getDefaultRecipient = React.useCallback(
    () => readLastRecipient(userId) ?? userEmail,
    [userEmail, userId],
  );

  const rememberRecipient = React.useCallback(
    (email: string) => {
      const value = email.trim();
      if (!isValidTestRecipient(value)) return;
      try {
        window.sessionStorage.setItem(storageKey(userId), value);
      } catch {
        // Storage can be blocked (private mode); the user's email still fills in.
      }
    },
    [userId],
  );

  return { getDefaultRecipient, rememberRecipient };
}
