import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { ForgotPasswordPage } from "./ForgotPasswordPage";

const supabaseMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: supabaseMocks.resetPasswordForEmail,
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

const SentProbe = () => {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return <div data-testid="sent-email">{email}</div>;
};

const renderForgotPasswordPage = () =>
  render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/forgot-password/sent" element={<SentProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ForgotPasswordPage polish", () => {
  beforeEach(() => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows exact email validation copy and clears it as the value is corrected", () => {
    renderForgotPasswordPage();

    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(
      screen.getByText("Please enter your email address"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "not-an-email" },
    });
    expect(
      screen.getByText("Please enter a valid email address"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "owner@example.com" },
    });
    expect(
      screen.queryByText("Please enter a valid email address"),
    ).not.toBeInTheDocument();
  });

  it("submits a trimmed email and navigates to the sent confirmation", async () => {
    renderForgotPasswordPage();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: " owner@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByTestId("sent-email")).toHaveTextContent(
      "owner@example.com",
    );
    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/reset-password"),
      }),
    );
  });
});
