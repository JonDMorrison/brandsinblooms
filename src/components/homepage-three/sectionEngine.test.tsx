import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import {
  getSectionIndexFromHash,
  normalizeHashSlug,
  resolveTransitionForPair,
  useSectionEngine,
} from "./sectionEngine";

const EngineProbe = () => {
  const engine = useSectionEngine({
    sectionCount: 3,
    defaultDurationMs: 700,
    transitionPairs: [{ from: 0, to: 1, type: "scale-fade", durationMs: 800 }],
  });

  return (
    <div
      data-testid="engine"
      data-current={engine.currentSection}
      data-progress={engine.transitionProgress}
      data-transitioning={engine.isTransitioning}
      data-direction={engine.transitionDirection}
      data-duration={engine.transitionDurationMs}
    >
      <button type="button" onClick={() => engine.advance()}>
        advance
      </button>
      <button type="button" onClick={() => engine.retreat()}>
        retreat
      </button>
      <button type="button" onClick={() => engine.goTo(2)}>
        last
      </button>
      <button type="button" onClick={() => engine.goTo(2, { force: true })}>
        force last
      </button>
      <button
        type="button"
        onClick={() => engine.goTo(2, { speedMultiplier: 1.5, force: true })}
      >
        fast last
      </button>
    </div>
  );
};

describe("sectionEngine", () => {
  it("sanitizes URL hashes against known section slugs", () => {
    expect(normalizeHashSlug("#AI")).toBe("ai");
    expect(normalizeHashSlug("#bad<script>")).toBe("");
    expect(getSectionIndexFromHash("#pricing", ["hero", "pricing"])).toBe(1);
    expect(getSectionIndexFromHash("#unknown", ["hero", "pricing"])).toBeNull();
  });

  it("uses symmetric transition config for retreat animations", () => {
    expect(
      resolveTransitionForPair({
        from: 1,
        to: 0,
        transitionPairs: [
          { from: 0, to: 1, type: "crossfade-hold", durationMs: 640 },
        ],
      }),
    ).toEqual({ type: "crossfade-hold", durationMs: 640 });
  });

  it("advances one section and throttles immediate repeat input", () => {
    render(<EngineProbe />);
    const engine = screen.getByTestId("engine");

    act(() => {
      fireEvent.click(screen.getByText("advance"));
      fireEvent.click(screen.getByText("advance"));
    });

    expect(engine).toHaveAttribute("data-current", "1");
    expect(engine).toHaveAttribute("data-transitioning", "true");
    expect(engine).toHaveAttribute("data-direction", "forward");
  });

  it("treats first and last section overflow navigation as no-ops", () => {
    render(<EngineProbe />);
    const engine = screen.getByTestId("engine");

    act(() => {
      fireEvent.click(screen.getByText("retreat"));
    });

    expect(engine).toHaveAttribute("data-current", "0");

    act(() => {
      fireEvent.click(screen.getByText("last"));
      fireEvent.click(screen.getByText("advance"));
    });

    expect(engine).toHaveAttribute("data-current", "2");
  });

  it("allows direct forced navigation during an active transition", () => {
    render(<EngineProbe />);
    const engine = screen.getByTestId("engine");

    act(() => {
      fireEvent.click(screen.getByText("advance"));
      fireEvent.click(screen.getByText("force last"));
    });

    expect(engine).toHaveAttribute("data-current", "2");
  });

  it("shortens forced progress navigation to 1.5x speed", () => {
    render(<EngineProbe />);
    const engine = screen.getByTestId("engine");

    act(() => {
      fireEvent.click(screen.getByText("fast last"));
    });

    expect(engine).toHaveAttribute("data-current", "2");
    expect(engine).toHaveAttribute("data-duration", `${700 / 1.5}`);
  });
});
