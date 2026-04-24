import { startTransition, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export type UseAsyncAutocompleteOptions<T> = {
  query: string;
  loadOptions: (
    query: string,
    signal: AbortSignal,
  ) => Promise<readonly T[] | T[]> | readonly T[] | T[];
  enabled?: boolean;
  debounceMs?: number;
  minQueryLength?: number;
  initialOptions?: readonly T[];
  keepPreviousOptions?: boolean;
  onError?: (error: unknown) => void;
};

export type UseAsyncAutocompleteResult<T> = {
  options: T[];
  loading: boolean;
  error: unknown;
  debouncedQuery: string;
  hasMinQuery: boolean;
  refresh: () => void;
  reset: () => void;
};

const toArray = <T>(value: readonly T[] | T[] | undefined): T[] =>
  value ? Array.from(value) : [];

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError";

export function useAsyncAutocomplete<T>({
  query,
  loadOptions,
  enabled = true,
  debounceMs = 250,
  minQueryLength = 0,
  initialOptions = [],
  keepPreviousOptions = true,
  onError,
}: UseAsyncAutocompleteOptions<T>): UseAsyncAutocompleteResult<T> {
  const debouncedQuery = useDebounce(query, debounceMs);
  const [options, setOptions] = useState<T[]>(() => toArray(initialOptions));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestSequenceRef = useRef(0);

  const hasMinQuery = debouncedQuery.length >= minQueryLength;

  useEffect(() => {
    if (!enabled || !hasMinQuery) {
      requestSequenceRef.current += 1;
      setLoading(false);
      setError(null);
      startTransition(() => {
        setOptions(toArray(initialOptions));
      });
      return;
    }

    const controller = new AbortController();
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    setLoading(true);
    setError(null);

    if (!keepPreviousOptions) {
      startTransition(() => {
        setOptions([]);
      });
    }

    Promise.resolve(loadOptions(debouncedQuery, controller.signal))
      .then((nextOptions) => {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        startTransition(() => {
          setOptions(toArray(nextOptions));
        });
      })
      .catch((nextError) => {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current ||
          isAbortError(nextError)
        ) {
          return;
        }

        setError(nextError);
        onError?.(nextError);

        if (!keepPreviousOptions) {
          startTransition(() => {
            setOptions(toArray(initialOptions));
          });
        }
      })
      .finally(() => {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    debouncedQuery,
    enabled,
    hasMinQuery,
    initialOptions,
    keepPreviousOptions,
    loadOptions,
    onError,
    refreshIndex,
  ]);

  return {
    options,
    loading,
    error,
    debouncedQuery,
    hasMinQuery,
    refresh: () => {
      setRefreshIndex((current) => current + 1);
    },
    reset: () => {
      requestSequenceRef.current += 1;
      setLoading(false);
      setError(null);
      startTransition(() => {
        setOptions(toArray(initialOptions));
      });
    },
  };
}
