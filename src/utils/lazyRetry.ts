import { lazy, type ComponentType } from "react";

const RETRY_DELAY_MS = 1000;

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function loadWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries: number,
): Promise<{ default: T }> {
  try {
    return await importFn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    await wait(RETRY_DELAY_MS);

    return loadWithRetry(importFn, retries - 1);
  }
}

export function lazyRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 1,
) {
  return lazy(() => loadWithRetry(importFn, retries));
}

export default lazyRetry;
