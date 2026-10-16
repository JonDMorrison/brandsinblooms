import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_PRESS_DURATION_MS,
  prefersReducedDashboardMotion,
  useDashboardPressNavigation,
} from "./dashboardPressMotion";

function PressTestPage() {
  const { open, activeAction } = useDashboardPressNavigation();
  return (
    <>
      <button
        onClick={() => open("email", "/newsletters/new")}
        data-activating={activeAction === "email" ? "true" : undefined}
      >
        {activeAction === "email" ? "Opening email" : "Create an email"}
      </button>
      <button onClick={() => open("sms", "/sms/new")}>Send a text</button>
      <span data-testid="pending">{activeAction ?? "idle"}</span>
    </>
  );
}
function Location() {
  return <div data-testid="destination">{useLocation().pathname}</div>;
}
function fixture() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<PressTestPage />} />
        <Route path="/newsletters/new" element={<Location />} />
        <Route path="/sms/new" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dashboard tactile navigation", () => {
  it("depresses and changes the label before changing routes, without a jarring instant swap", () => {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "Create an email" }));
    expect(screen.getByText("Opening email")).toBeVisible();
    expect(screen.getByText("Opening email").closest("button")).toHaveAttribute(
      "data-activating",
      "true",
    );
    expect(screen.queryByTestId("destination")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(DASHBOARD_PRESS_DURATION_MS - 1);
    });
    expect(screen.queryByTestId("destination")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/newsletters/new",
    );
  });
  it("ignores a rapid second tap rather than navigating twice to different destinations", () => {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "Create an email" }));
    fireEvent.click(screen.getByRole("button", { name: "Send a text" }));
    expect(screen.getByTestId("pending")).toHaveTextContent("email");
    act(() => {
      vi.advanceTimersByTime(DASHBOARD_PRESS_DURATION_MS);
    });
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/newsletters/new",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it("navigates immediately when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedDashboardMotion()).toBe(true);
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "Create an email" }));
    expect(screen.getByTestId("destination")).toHaveTextContent(
      "/newsletters/new",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a pending navigation if the dashboard unmounts", () => {
    const rendered = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Create an email" }));
    expect(vi.getTimerCount()).toBe(1);
    rendered.unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });
});
