import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The real SenderVerificationDialog pulls in useSenderConfiguration,
// which touches supabase auth at module load time. We're not testing
// that dialog here — stub it to a no-op render so the modal tests
// stay focused and don't require the supabase test harness.
vi.mock("@/components/crm/campaign-editor/SenderVerificationDialog", () => ({
  SenderVerificationDialog: () => null,
}));

import { SenderConfigModal } from "@/components/crm/campaign-editor/SenderConfigModal";

describe("SenderConfigModal", () => {
  it("hydrates inputs from props when opening", () => {
    render(
      <SenderConfigModal
        open
        onClose={() => {}}
        senderName="Jon Morrison Inc."
        senderEmail="mail@emergingthoughtleader.com"
        replyTo="hello@example.com"
        onSave={() => {}}
      />,
    );

    expect(screen.getByDisplayValue("Jon Morrison Inc.")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("mail@emergingthoughtleader.com"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("hello@example.com")).toBeInTheDocument();
  });

  it("renders the helper text for the reply-to field", () => {
    render(
      <SenderConfigModal
        open
        onClose={() => {}}
        senderName=""
        senderEmail=""
        replyTo=""
        onSave={() => {}}
      />,
    );
    expect(
      screen.getAllByText("Defaults to sender email if blank").length,
    ).toBeGreaterThan(0);
  });

  it("Save passes edited values back to onSave and closes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SenderConfigModal
        open
        onClose={onClose}
        senderName="Old Name"
        senderEmail="old@example.com"
        replyTo=""
        onSave={onSave}
      />,
    );

    const nameInput = screen.getByDisplayValue("Old Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    await user.click(screen.getByTestId("sender-config-modal-save"));

    expect(onSave).toHaveBeenCalledWith({
      senderName: "New Name",
      senderEmail: "old@example.com",
      replyTo: "",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Cancel closes without invoking onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SenderConfigModal
        open
        onClose={onClose}
        senderName="Jon"
        senderEmail="mail@example.com"
        replyTo=""
        onSave={onSave}
      />,
    );

    await user.click(screen.getByTestId("sender-config-modal-cancel"));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("leaves replyTo blank when the field is left empty (no auto-fill)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <SenderConfigModal
        open
        onClose={() => {}}
        senderName="Jon"
        senderEmail="mail@example.com"
        replyTo=""
        onSave={onSave}
      />,
    );

    await user.click(screen.getByTestId("sender-config-modal-save"));

    expect(onSave).toHaveBeenCalledWith({
      senderName: "Jon",
      senderEmail: "mail@example.com",
      replyTo: "",
    });
  });

  it("disables Verify when email is blank", () => {
    render(
      <SenderConfigModal
        open
        onClose={() => {}}
        senderName=""
        senderEmail=""
        replyTo=""
        onSave={() => {}}
      />,
    );
    expect(screen.getByTestId("sender-config-modal-verify")).toBeDisabled();
  });
});
