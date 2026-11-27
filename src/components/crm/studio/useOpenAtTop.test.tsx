import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_AT_TOP_SETTLE_MS, useOpenAtTop } from "./useOpenAtTop";

function Canvas() {
  const ref = React.useRef<HTMLDivElement>(null);
  useOpenAtTop(ref);
  return <div ref={ref} data-testid="canvas" />;
}

describe("Studio opens at the top of the email", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a scroll the person did not make while the email settles goes back to the top", () => {
    const { getByTestId } = render(<Canvas />);
    const canvas = getByTestId("canvas");
    expect(canvas.scrollTop).toBe(0);
    canvas.scrollTop = 619;
    fireEvent.scroll(canvas);
    expect(canvas.scrollTop).toBe(0);
  });

  it("resets a window left scrolled by the previous page", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", { value: 619, configurable: true });
    render(<Canvas />);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    scrollTo.mockRestore();
  });

  it("once the person scrolls, clicks or types, Studio leaves the position alone", () => {
    for (const input of ["wheel", "pointerDown", "keyDown", "touchStart"] as const) {
      const { getByTestId, unmount } = render(<Canvas />);
      const canvas = getByTestId("canvas");
      fireEvent[input](canvas);
      canvas.scrollTop = 619;
      fireEvent.scroll(canvas);
      expect(canvas.scrollTop, input).toBe(619);
      unmount();
    }
  });

  it("stops guarding after the email has settled", () => {
    const { getByTestId } = render(<Canvas />);
    const canvas = getByTestId("canvas");
    act(() => {
      vi.advanceTimersByTime(OPEN_AT_TOP_SETTLE_MS + 1);
    });
    canvas.scrollTop = 400;
    fireEvent.scroll(canvas);
    expect(canvas.scrollTop).toBe(400);
  });
});
