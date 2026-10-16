import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("campaign sending design and palette invariants", () => {
  it("keeps the review and schedule controls before the long editor content", () => {
    const editor = source("src/pages/crm/CRMCampaignEditorPage.tsx");
    const sendPosition = editor.indexOf('data-testid="campaign-editor-send-toolbar"');
    const setupPosition = editor.indexOf('id="campaign-editor-setup"');
    const contentPosition = editor.indexOf('id="campaign-editor-content"');

    expect(sendPosition).toBeGreaterThan(0);
    expect(sendPosition).toBeLessThan(setupPosition);
    expect(sendPosition).toBeLessThan(contentPosition);
    expect(editor).toContain('position: "sticky"');
    expect(editor).toContain('data-testid="campaign-editor-review-send-cta"');
    expect(editor).toContain('data-testid="campaign-editor-schedule-cta"');
    expect(editor).toContain('data-testid="campaign-editor-fix-sender"');
    expect(editor).toContain("disabled={sendButtonDisabled}");
    expect(editor).toContain("onClick={openSendConfirmation}");
    expect(editor).toContain("onClick={handleScheduleForLater}");
    expect(editor).not.toContain("scheduleInitiallyExpanded");
    expect(editor).not.toContain("previewManuallyToggledRef");
    expect((editor.match(/<CampaignBlockerRow/g) ?? []).length).toBe(1);
  });

  it("removes the beige/sand colors from the actual app theme and shell", () => {
    const theme = source("src/config/joy-theme.ts");
    const shell = source("src/components/layout/DashboardShell.tsx");
    const bridge = source("src/styles/joy-tailwind-bridge.css");
    const tailwind = source("tailwind.config.ts");
    const headerBand = source("src/components/joy/JoyPageHeaderBand.tsx");

    expect(theme).not.toContain("bloomPaletteScales.sand");
    expect(theme).not.toContain("sandPalette");
    expect(theme).not.toContain('"background-hsl": "46 80% 97%"');
    expect(theme).toContain("body: bloomPaletteScales.neutral[50]");
    expect(bridge).not.toContain("--sand-50");
    expect(tailwind).not.toMatch(/^\s+sand: \{/m);
    expect(shell).not.toContain("--joy-palette-sand-50");
    expect(headerBand).not.toContain("--joy-palette-sand-50");
  });

  it("uses modern shared dialogs instead of cream legacy senders", () => {
    const sender = source("src/components/crm/campaigns/SenderVerificationModal.tsx");
    const settings = source("src/components/crm/campaign-editor/SenderConfigModal.tsx");

    expect(sender).toContain("<JoyDialog");
    expect(sender).toContain("onChooseVerifiedSender(verifiedSenderEmail)");
    expect(sender).not.toContain("ui-legacy/dialog");
    expect(sender).not.toContain("bg-amber-50");
    expect(settings).toContain("<JoyDialog");
    expect(settings).not.toContain("ui-legacy/dialog");
    expect(settings).toContain('data-testid="sender-config-modal-save"');
  });
});
