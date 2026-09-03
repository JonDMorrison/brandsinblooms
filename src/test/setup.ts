import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!window.ResizeObserver) {
  class ResizeObserverStub implements ResizeObserver {
    observe() {
      // JSDOM has no layout engine.
    }
    unobserve() {
      // JSDOM has no layout engine.
    }
    disconnect() {
      // JSDOM has no layout engine.
    }
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverStub,
  });
}

if (!window.IntersectionObserver) {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];

    disconnect() {
      // JSDOM has no layout engine.
    }
    observe() {
      // Tests opt into intersection behavior explicitly when needed.
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve() {
      // JSDOM has no layout engine.
    }
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: IntersectionObserverStub,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: IntersectionObserverStub,
  });
}
