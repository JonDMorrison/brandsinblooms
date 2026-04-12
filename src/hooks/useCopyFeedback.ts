import { useEffect, useRef, useState } from "react";

import { copyTextToClipboard } from "@/lib/clipboard";

export type CopyFeedbackState = "idle" | "success" | "error";

export const COPY_FEEDBACK_DURATION_MS = 2000;

interface CopyValueOptions {
  key: string;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  value: string;
}

export function useCopyFeedback() {
  const [states, setStates] = useState<Record<string, CopyFeedbackState>>({});
  const timeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  const setTemporaryState = (key: string, state: CopyFeedbackState) => {
    setStates((current) => ({
      ...current,
      [key]: state,
    }));

    if (timeoutsRef.current[key]) {
      window.clearTimeout(timeoutsRef.current[key]);
    }

    timeoutsRef.current[key] = window.setTimeout(() => {
      setStates((current) => ({
        ...current,
        [key]: "idle",
      }));
    }, COPY_FEEDBACK_DURATION_MS);
  };

  const copyValue = async ({
    key,
    onError,
    onSuccess,
    value,
  }: CopyValueOptions) => {
    try {
      await copyTextToClipboard(value);
      setTemporaryState(key, "success");
      onSuccess?.();
      return true;
    } catch (error) {
      setTemporaryState(key, "error");
      onError?.(error);
      return false;
    }
  };

  const getCopyState = (key: string): CopyFeedbackState =>
    states[key] ?? "idle";

  return {
    copyValue,
    getCopyState,
  };
}
