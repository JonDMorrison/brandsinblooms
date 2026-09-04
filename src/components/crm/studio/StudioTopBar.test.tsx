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
    const { onSaveAsTemplate } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(onSaveAsTemplate).toHaveBeenCalledOnce();
  });

  it("disables template saving for an empty canvas", () => {
    renderTopBar({ blockCount: 0 });

    expect(
      screen.getByRole("button", { name: "Save template" }),
    ).toBeDisabled();
  });
});
