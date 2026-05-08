import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypewriter } from "../useTypewriter";

describe("useTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default matchMedia stub: not reduced-motion.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts empty and types the first phrase character-by-character at typeSpeedMs", () => {
    const phrases = ["abc"];
    const { result } = renderHook(() =>
      useTypewriter({ phrases, typeSpeedMs: 50 }),
    );

    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("ab");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("abc");
  });

  it("returns the first phrase immediately and never advances when reduce-motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const phrases = ["one", "two"];
    const { result } = renderHook(() =>
      useTypewriter({
        phrases,
        typeSpeedMs: 10,
        eraseSpeedMs: 10,
        pauseAfterTypeMs: 10,
        pauseAfterEraseMs: 10,
      }),
    );

    expect(result.current).toBe("one");

    // Advance well past every configured timer interval — value must
    // not change because the reduced-motion branch returns early
    // before scheduling timeouts.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe("one");
  });
});
