import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AuthPage } from "@/components/auth/AuthPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

const successMessage =
  "Password reset successful. Please sign in with your new password.";

const authMocks = vi.hoisted(() => ({
  clearRecoveryMode: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: supabaseMocks.signOut,
      updateUser: supabaseMocks.updateUser,
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    clearRecoveryMode: authMocks.clearRecoveryMode,
  }),
}));

vi.mock("@/components/homepage-three/performance/useDeviceTier", () => ({
  useDeviceTier: () => ({
    tier: "fallback",
    animationsDisabled: false,
    setAnimationsDisabled: vi.fn(),
    reportFrame: vi.fn(),
  }),
}));

const AuthStateProbe = () => {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return <div data-testid="auth-state-message">{message}</div>;
};

const renderResetPage = () =>
  render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth" element={<AuthStateProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const renderActiveResetPage = async () => {
  supabaseMocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "user-1" } } },
  });

  renderResetPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
};

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: supabaseMocks.unsubscribe } },
    });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    supabaseMocks.updateUser.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the reset-link verification state without form controls", () => {
    renderResetPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Verifying your reset link...",
    );
    expect(
      screen.getByText("Verifying your reset link..."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset Password" }),
    ).not.toBeInTheDocument();
  });

  it("shows the expired-link state after verification cannot establish a session", async () => {
    renderResetPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(
      screen.getByRole("heading", { name: "Link Expired" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This password reset link is invalid or has expired. Please request a new one.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request New Link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Back to Sign In" }),
    ).toHaveAttribute("href", "/auth#signin");
  });

  it("validates the active form, updates password, signs out, and navigates with state", async () => {
    await renderActiveResetPage();

    const newPasswordInput = screen.getByLabelText(
      "New Password",
    ) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(
      "Confirm Password",
    ) as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: "Reset Password" });

    expect(
      screen.getByRole("heading", { name: "Set your new password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose a strong password for your account."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Show password" }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Show password" })[0],
    );
    expect(newPasswordInput.type).toBe("text");
    expect(confirmPasswordInput.type).toBe("password");

    fireEvent.click(submitButton);
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(
      screen.getByText("Please confirm your password"),
    ).toBeInTheDocument();
    expect(newPasswordInput).toHaveFocus();

    fireEvent.change(newPasswordInput, { target: { value: "abcde" } });
    fireEvent.blur(newPasswordInput);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 6 characters"),
    ).toBeInTheDocument();

    fireEvent.change(newPasswordInput, { target: { value: "StrongPass1!" } });
    expect(screen.getByText("Strong")).toBeInTheDocument();

    fireEvent.change(confirmPasswordInput, {
      target: { value: "Different1!" },
    });
    fireEvent.blur(confirmPasswordInput);
    expect(screen.getAllByText("Passwords don't match")).toHaveLength(1);

    fireEvent.change(confirmPasswordInput, {
      target: { value: "StrongPass1!" },
    });
    expect(screen.getByText("Passwords match")).toBeInTheDocument();

    let resolveUpdate: (value: { error: null }) => void = () => undefined;
    supabaseMocks.updateUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    fireEvent.click(submitButton);
    expect(submitButton).toHaveAttribute("aria-busy", "true");
    expect(supabaseMocks.updateUser).toHaveBeenCalledWith({
      password: "StrongPass1!",
    });

    await act(async () => {
      resolveUpdate({ error: null });
    });

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authMocks.clearRecoveryMode).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Password updated!")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByTestId("auth-state-message")).toHaveTextContent(
      successMessage,
    );
  });

  it("shows an AuthAlert when the password update fails", async () => {
    await renderActiveResetPage();

    supabaseMocks.updateUser.mockResolvedValue({
      error: new Error("Invalid session"),
    });

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveClass("auth-alert--error");
    expect(
      screen.getByText(/Something went wrong\. Please try again/i),
    ).toBeInTheDocument();
  });

  it("renders the reset success message on the auth page as a success alert", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/auth", state: { message: successMessage } },
        ]}
      >
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(successMessage)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("auth-alert--success");
  });
});
