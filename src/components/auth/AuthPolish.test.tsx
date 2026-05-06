import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthAlert,
  AuthInput,
  AuthPasswordStrength,
  AuthStepProgress,
  AuthTabGroup,
} from "@/components/auth";
import { useState } from "react";

describe("auth polish primitives", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders alerts as assertive alerts and dismisses them on Escape", () => {
    const onDismiss = vi.fn();

    render(
      <AuthAlert variant="error" onDismiss={onDismiss} autoDismissMs={0}>
        Unable to connect.
      </AuthAlert>,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-dismisses alerts after eight seconds by default", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <AuthAlert variant="success" onDismiss={onDismiss}>
        Password reset successful.
      </AuthAlert>,
    );

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps password visibility controls in the tab order", () => {
    render(
      <AuthInput
        id="polish-password"
        label="Password"
        type="password"
        value="secret"
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("labels step progress items for assistive technology", () => {
    render(
      <AuthStepProgress
        steps={["Website URL", "Review & Confirm", "Launch"]}
        currentStep={2}
      />,
    );

    expect(
      screen.getByLabelText("Step 2 of 3: Review & Confirm"),
    ).toHaveAttribute("aria-current", "step");
  });

  it("announces password strength with an accessible label", () => {
    render(<AuthPasswordStrength password="StrongPass1!" />);

    expect(
      screen.getByLabelText("Password strength: Strong"),
    ).toBeInTheDocument();
  });

  it("supports arrow-key tab switching", () => {
    const TabHarness = () => {
      const [value, setValue] = useState("signin");

      return (
        <AuthTabGroup
          ariaLabel="Auth mode"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "signin", label: "Sign In" },
            { value: "signup", label: "Sign Up" },
          ]}
        />
      );
    };

    render(<TabHarness />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Sign In" }), {
      key: "ArrowRight",
    });

    expect(screen.getByRole("tab", { name: "Sign Up" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
