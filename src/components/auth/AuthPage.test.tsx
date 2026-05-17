import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthPage } from "@/components/auth/AuthPage";

const supabaseMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
      signOut: supabaseMocks.signOut,
      resend: supabaseMocks.resend,
    },
    functions: {
      invoke: supabaseMocks.invoke,
    },
  },
}));

vi.mock("@/components/homepage-three/performance/useDeviceTier", () => ({
  useDeviceTier: () => ({
    tier: "fallback",
    animationsDisabled: false,
    setAnimationsDisabled: vi.fn(),
    reportFrame: vi.fn(),
  }),
}));

const renderAuthPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AuthPage Reset session escape hatch", () => {
  let replaceMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    supabaseMocks.invoke.mockResolvedValue({ data: null, error: null });
    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    supabaseMocks.resend.mockResolvedValue({ data: null, error: null });

    localStorage.clear();
    sessionStorage.clear();

    originalLocation = window.location;
    replaceMock = vi.fn();

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        replace: replaceMock,
        href: originalLocation.href,
        origin: originalLocation.origin,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("renders the Reset session button on the sign-in form", () => {
    renderAuthPage();
    expect(
      screen.getByRole("button", { name: /Reset session/i }),
    ).toBeInTheDocument();
  });

  it("clears prefixed localStorage and sessionStorage keys then redirects on click", async () => {
    localStorage.setItem("sb-foo-auth-token", "value-1");
    localStorage.setItem("supabase.auth.token", "value-2");
    localStorage.setItem("bloomsuite.something", "value-3");
    localStorage.setItem("unrelated.key", "keep-me");
    sessionStorage.setItem(
      "bloomsuite.auth.recovery-mode",
      "true",
    );

    renderAuthPage();

    fireEvent.click(screen.getByRole("button", { name: /Reset session/i }));

    await Promise.resolve();
    await Promise.resolve();

    expect(localStorage.getItem("sb-foo-auth-token")).toBeNull();
    expect(localStorage.getItem("supabase.auth.token")).toBeNull();
    expect(localStorage.getItem("bloomsuite.something")).toBeNull();
    expect(localStorage.getItem("unrelated.key")).toBe("keep-me");
    expect(sessionStorage.getItem("bloomsuite.auth.recovery-mode")).toBeNull();

    expect(supabaseMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(replaceMock).toHaveBeenCalledWith("/auth");
  });

  it("still clears storage and redirects when signOut throws", async () => {
    supabaseMocks.signOut.mockRejectedValue(new Error("network down"));
    localStorage.setItem("sb-foo", "x");

    renderAuthPage();

    fireEvent.click(screen.getByRole("button", { name: /Reset session/i }));

    await Promise.resolve();
    await Promise.resolve();

    expect(localStorage.getItem("sb-foo")).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith("/auth");
  });
});
