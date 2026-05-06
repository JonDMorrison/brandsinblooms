import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthPage } from "@/components/auth/AuthPage";

const supabaseMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
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

const renderAuthPage = (initialEntry = "/auth") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AuthPage polish", () => {
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows exact sign-in validation and invalid-credential copy", async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid login credentials"),
    });

    renderAuthPage();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "bad-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email or password you entered is incorrect.",
    );
  });

  it("uses exact network copy for sign-in failures", async () => {
    supabaseMocks.signInWithPassword.mockRejectedValue(
      new Error("Failed to fetch"),
    );

    renderAuthPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect. Please check your internet connection.",
    );
  });

  it("keeps sign-up links and password toggle keyboard reachable", () => {
    renderAuthPage("/auth#signup");

    screen
      .getAllByRole("link", { name: "Terms of Service" })
      .forEach((link) => {
        expect(link).not.toHaveAttribute("tabindex", "-1");
      });
    screen.getAllByRole("link", { name: "Privacy Policy" }).forEach((link) => {
      expect(link).not.toHaveAttribute("tabindex", "-1");
    });
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("shows exact sign-up password, duplicate-account, and network error copy", async () => {
    renderAuthPage("/auth#signup");

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Avery Bloom" },
    });
    fireEvent.change(screen.getByLabelText("Company Name"), {
      target: { value: "Bloom Garden Center" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      screen.getByText("Password must be at least 6 characters"),
    ).toBeInTheDocument();

    supabaseMocks.signUp.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("User already registered"),
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    const duplicateAlert = await screen.findByRole("alert");
    expect(duplicateAlert).toHaveTextContent(
      "An account with this email already exists.",
    );
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Sign Up" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Account" }),
      ).toBeInTheDocument(),
    );
    supabaseMocks.signUp.mockRejectedValueOnce(new Error("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect.",
    );
  });
});
