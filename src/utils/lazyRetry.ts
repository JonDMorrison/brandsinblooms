import { lazy, type ComponentType } from "react";

const RETRY_DELAY_MS = 1000;
const CHUNK_ERROR_SIGNATURES = [
  "Loading chunk",
  "ChunkLoadError",
  "dynamically imported module",
  "Failed to fetch",
  "Importing a module script failed",
  "error loading dynamically imported module",
] as const;
const RELOAD_MARKER_KEY = "lazy-retry:chunk-refresh";

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

const isChunkLoadError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) {
    return false;
  }

  return CHUNK_ERROR_SIGNATURES.some((signature) =>
    error.message.includes(signature),
  );
};

const getReloadMarker = () => {
  if (typeof window === "undefined") {
    return RELOAD_MARKER_KEY;
  }

  return `${RELOAD_MARKER_KEY}:${window.location.pathname}${window.location.search}`;
};

const clearReloadMarker = (reloadMarker: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(reloadMarker);
  } catch {
    // Ignore sessionStorage availability errors and leave fallback behavior unchanged.
  }
};

const reloadOnceForChunkError = async <T extends ComponentType<unknown>>(
  error: unknown,
  reloadMarker: string,
): Promise<{ default: T }> => {
  if (typeof window === "undefined" || !isChunkLoadError(error)) {
    throw error;
  }

  try {
    const hasReloaded = window.sessionStorage.getItem(reloadMarker) === "true";

    if (hasReloaded) {
      window.sessionStorage.removeItem(reloadMarker);
      throw error;
    }

    window.sessionStorage.setItem(reloadMarker, "true");
  } catch {
    // If storage is unavailable, still attempt a one-off hard refresh.
  }

  window.location.reload();

  return new Promise<{ default: T }>(() => {
    // The page is reloading; keep the lazy promise pending until navigation replaces this context.
  });
};

async function loadWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries: number,
  reloadMarker: string,
): Promise<{ default: T }> {
  try {
    const module = await importFn();
    clearReloadMarker(reloadMarker);
    return module;
  } catch (error) {
    if (retries <= 0) {
      return reloadOnceForChunkError<T>(error, reloadMarker);
    }

    await wait(RETRY_DELAY_MS);

    return loadWithRetry(importFn, retries - 1, reloadMarker);
  }
}

export function lazyRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 1,
) {
  return lazy(() => loadWithRetry(importFn, retries, getReloadMarker()));
}

export default lazyRetry;
