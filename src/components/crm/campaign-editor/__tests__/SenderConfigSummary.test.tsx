import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SenderConfigSummary } from "@/components/crm/campaign-editor/SenderConfigSummary";

describe("SenderConfigSummary", () => {
  it("shows the Configure sender link when sender_email is empty", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <SenderConfigSummary
        senderDisplayName=""
        senderEmail=""
        isVerified={false}
        onEdit={onEdit}
      />,
    );

    const configure = screen.getByTestId("sender-config-summary-configure");
    expect(configure).toBeInTheDocument();
    await user.click(configure);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(
      screen.queryByTestId("sender-config-summary"),
    ).not.toBeInTheDocument();
  });

  it("renders From + Verified chip + Edit when verified", () => {
    render(
      <SenderConfigSummary
        senderDisplayName="Jon Morrison Inc."
        senderEmail="mail@emergingthoughtleader.com"
        isVerified
        onEdit={() => {}}
      />,
    );

    expect(screen.getByTestId("sender-config-summary")).toBeInTheDocument();
    expect(screen.getByText("From:")).toBeInTheDocument();
    expect(
      screen.getByText("Jon Morrison Inc. <mail@emergingthoughtleader.com>"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("sender-config-summary-verified"),
    ).toHaveTextContent("Verified");
    expect(
      screen.queryByTestId("sender-config-summary-unverified"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("sender-config-summary-edit"),
    ).toBeInTheDocument();
  });

  it("renders Unverified chip in warning color when not verified", () => {
    render(
      <SenderConfigSummary
        senderDisplayName="Jon Morrison Inc."
        senderEmail="mail@emergingthoughtleader.com"
        isVerified={false}
        onEdit={() => {}}
      />,
    );

    const chip = screen.getByTestId("sender-config-summary-unverified");
    expect(chip).toHaveTextContent("Unverified");
  });

  it("renders email only when display name is blank", () => {
    render(
      <SenderConfigSummary
        senderDisplayName=""
        senderEmail="mail@example.com"
        isVerified
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("mail@example.com")).toBeInTheDocument();
  });

  it("disables Edit when isLocked", () => {
    render(
      <SenderConfigSummary
        senderDisplayName="Jon"
        senderEmail="mail@example.com"
        isVerified
        isLocked
        onEdit={() => {}}
      />,
    );
    expect(screen.getByTestId("sender-config-summary-edit")).toBeDisabled();
  });

  it("Edit button fires onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <SenderConfigSummary
        senderDisplayName="Jon"
        senderEmail="mail@example.com"
        isVerified
        onEdit={onEdit}
      />,
    );
    await user.click(screen.getByTestId("sender-config-summary-edit"));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
