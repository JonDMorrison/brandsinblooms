import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as ts from "typescript";

const source = (path: string) => readFileSync(path, "utf8");

describe("campaign sending design and palette invariants", () => {
  it("orders campaign steps and keeps sending behind permission and confirmation", () => {
    const editor = source("src/pages/crm/CRMCampaignEditorPage.tsx");
    const positions = ["setup", "inbox", "audience", "content", "actions"].map(id => editor.indexOf(`id="campaign-editor-${id}"`));
    expect(positions.every(position => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a,b) => a-b));
    const ast = ts.createSourceFile("editor.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let cta: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ast) === "data-testid" && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text === "campaign-editor-review-send-cta")) cta = node;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const expression = (name: string) => {
      const prop = cta?.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === name) as ts.JsxAttribute;
      return ((prop.initializer as ts.JsxExpression).expression!).getText(ast);
    };
    const disabled = new Function("isLocked", "canSendCampaign", "pendingTemplateSave", "sendBlockers", `return (${expression("disabled")})`);
    expect(disabled(false, true, null, [])).toBe(false);
    expect(disabled(true, true, null, [])).toBe(true);
    expect(disabled(false, false, null, [])).toBe(true);
    expect(disabled(false, true, {}, [])).toBe(true);
    // #10: the button waits until every blocker in the checklist is fixed.
    expect(disabled(false, true, null, [{ message: "Add a subject line" }])).toBe(true);
    const schedule = vi.fn(), review = vi.fn();
    new Function("updateSchedule", "openSendConfirmation", `return (${expression("onClick")})`)(schedule, review)();
    expect(schedule).toHaveBeenCalledWith({sendImmediately: true, sendAt: null});
    expect(review).toHaveBeenCalledOnce();
    expect(editor).toContain("<CampaignSendConfirmation");
    expect(editor).toContain("builderBlockers={");
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
    expect(settings).not.toContain("isLocked || !draftEmail.trim()");
  });
});
