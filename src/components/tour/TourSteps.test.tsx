import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TourSteps } from "./TourSteps";

const state = vi.hoisted(() => ({ active: false, navigate: vi.fn() }));
vi.mock("@/contexts/QuickTourContext", () => ({
  useQuickTour: () => ({ tourProgress: { isActive: state.active } }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate }));
vi.mock("./TourTooltip", () => ({
  TourTooltip: ({ title, cta, onCta }: { title: string; cta?: string; onCta?: () => void }) =>
    <section><h2>{title}</h2>{cta && <button onClick={onCta}>{cta}</button>}</section>,
}));

beforeEach(() => {
  state.active = false;
  state.navigate.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("TourSteps", () => {
  it("mounts safely without loading animation files when the tour is inactive", () => {
    const view = render(<TourSteps />);
    expect(view.container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("renders without animations and opens the maintained POS integrations flow", async () => {
    state.active = true;
    await act(async () => { render(<TourSteps />); });
    expect(screen.getByRole("heading", { name: "Connect Your POS System" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Connect POS" }));
    expect(state.navigate).toHaveBeenCalledExactlyOnceWith("/integrations/pos");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("aborts pending animation reads when the tour is dismissed", async () => {
    state.active = true;
    const signals: AbortSignal[] = [];
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signals.push(init!.signal as AbortSignal);
      return new Promise(() => {});
    });
    const view = render(<TourSteps />);
    expect(signals).toHaveLength(3);
    state.active = false;
    view.rerender(<TourSteps />);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(view.container).toBeEmptyDOMElement();
  });
});
