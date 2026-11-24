import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StudioTopBar from "@/components/crm/studio/StudioTopBar";

vi.mock("@/components/crm/studio/StudioPreviewDialog", () => ({
  default: () => null,
}));

function renderTopBar(overrides: Record<string, unknown> = {}) {
  const onSaveAsTemplate = vi.fn();
  render(
    <StudioTopBar
      campaignId="campaign-1"
      campaignName="Spring campaign"
      onCampaignNameChange={() => {}}
      campaignStatus="Draft"
      blockCount={2}
      blocks={[]}
      deviceMode="desktop"
      onDeviceModeChange={() => {}}
      subjectLine="Spring is here"
      onSubjectLineChange={() => {}}
      previewText="Fresh ideas"
      onPreviewTextChange={() => {}}
      senderName="Garden Centre"
      onSenderNameChange={() => {}}
      senderEmail="hello@example.com"
      onSenderEmailChange={() => {}}
      saveStatus="saved"
      saveMessage={null}
      hasUnsavedChanges={false}
      externalUpdateNotice={null}
      onDismissExternalUpdate={() => {}}
      onReloadCampaign={() => {}}
      onSave={() => {}}
      onSaveAsTemplate={onSaveAsTemplate}
      onExit={() => {}}
      onUndo={() => {}}
      onRedo={() => {}}
      canUndo={false}
      canRedo={false}
      lastSavedAt="2026-09-03T00:00:00Z"
      {...overrides}
    />,
  );
  return { onSaveAsTemplate };
}

describe("StudioTopBar", () => {
  it("opens the current studio save-template flow", async () => {
    const user = userEvent.setup();
    const { onSaveAsTemplate } = renderTopBar({
      blocks: [{ id: "t", type: "plain-text", body: "<p>Spring is here</p>" }],
    });

    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(onSaveAsTemplate).toHaveBeenCalledOnce();
  });

  it("hides template saving until the design has content", () => {
    renderTopBar({
      blockCount: 2,
      blocks: [
        { id: "h", type: "newsletter-header" },
        { id: "e", type: "plain-text", body: "" },
      ],
    });

    expect(
      screen.queryByRole("button", { name: "Save template" }),
    ).not.toBeInTheDocument();
  });
  it("offers a save-and-review action alongside close", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    renderTopBar({ onExit, hasUnsavedChanges: true });
    await user.click(screen.getByRole("button", { name: "Review & Send" }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Save and close Design Studio" }),
    ).toBeInTheDocument();
  });

  it("stays clickable while an autosave runs (qa2 #7: first click with a panel open)", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    renderTopBar({ onExit, saveStatus: "saving", hasUnsavedChanges: true });
    const button = screen.getByRole("button", { name: "Review & Send" });
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("does not offer sending for an already sent campaign", () => {
    renderTopBar({ campaignStatus: "Sent" });
    expect(
      screen.queryByRole("button", { name: "Review & Send" }),
    ).not.toBeInTheDocument();
  });
});

describe("StudioTopBar subject dialog (#23)", () => {
  it("autosaves like the rest of Studio: no separate Save button, shared save state", async () => {
    const user = userEvent.setup();
    renderTopBar({ hasUnsavedChanges: true, saveStatus: "idle" });
    await user.click(screen.getByRole("button", { name: "Campaign settings" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByTestId("subject-dialog-save-state")).toHaveTextContent("Unsaved changes");
    expect(screen.getByText("Changes save automatically, like the rest of Design Studio.")).toBeInTheDocument();
  });
});
