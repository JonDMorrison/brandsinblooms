import "@testing-library/jest-dom/vitest";

import * as React from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock("@/components/crm/campaign-editor/CampaignSendConfirmation", async () => {
  return await vi.importActual<
    typeof import("@/components/crm/campaign-editor/CampaignSendConfirmation")
  >("@/components/crm/campaign-editor/CampaignSendConfirmation");
});

import {
  LowCountConfirmDialog,
  // re-export the dialog for direct testing
} from "@/components/crm/campaign-editor/CampaignSendConfirmation";

const renderInJoy = (ui: React.ReactElement) =>
  render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("LowCountConfirmDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders with focus on Cancel when count is 0", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderInJoy(
      <LowCountConfirmDialog
        open
        count={0}
        singleRecipientEmail={null}
        campaignName="Spring Newsletter"
        onCancel={onCancel}
        onConfirm={onConfirm}
        isSubmitting={false}
      />,
    );

    expect(
      screen.getByText(/Send to only 0 recipients\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Spring Newsletter/)).toBeInTheDocument();
    expect(screen.getByText(/No matching contact/i)).toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    const cancelButton = screen.getByTestId("low-count-cancel");
    expect(cancelButton).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("displays the recipient email when count is 1", () => {
    renderInJoy(
      <LowCountConfirmDialog
        open
        count={1}
        singleRecipientEmail="erin@minter.example"
        campaignName="So Much to Shop From"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(
      screen.getByText(/Send to only 1 recipient\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText("erin@minter.example")).toBeInTheDocument();
    expect(screen.getByText(/So Much to Shop From/)).toBeInTheDocument();
  });

  it("calls onConfirm when the user explicitly confirms", () => {
    const onConfirm = vi.fn();
    renderInJoy(
      <LowCountConfirmDialog
        open
        count={1}
        singleRecipientEmail="a@b.test"
        campaignName="Test"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getByTestId("low-count-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while a send is in flight", () => {
    renderInJoy(
      <LowCountConfirmDialog
        open
        count={0}
        singleRecipientEmail={null}
        campaignName="Test"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={true}
      />,
    );

    const cancelBtn = screen.getByTestId("low-count-cancel") as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
  });

  it("does not render when closed", () => {
    renderInJoy(
      <LowCountConfirmDialog
        open={false}
        count={0}
        singleRecipientEmail={null}
        campaignName="Hidden"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.queryByText(/Send to only/i)).not.toBeInTheDocument();
  });
});
