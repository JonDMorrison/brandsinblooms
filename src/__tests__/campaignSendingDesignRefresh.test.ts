import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

const source = (path: string) => readFileSync(path, "utf8");

describe("campaign sending design and palette invariants", () => {
  it("keeps design and review accessible above the editor, with scheduling in final review", () => {
    const editor = source("src/pages/crm/CRMCampaignEditorPage.tsx");
    const sendPosition = editor.indexOf('data-testid="campaign-editor-send-toolbar"');
    const setupPosition = editor.indexOf('id="campaign-editor-setup"');
    const contentPosition = editor.indexOf('id="campaign-editor-content"');

    expect(sendPosition).toBeGreaterThan(0);
    expect(sendPosition).toBeLessThan(setupPosition);
    expect(sendPosition).toBeLessThan(contentPosition);
    expect(editor).toContain('position: "sticky"');
    expect(editor).toContain('data-testid="campaign-editor-review-send-cta"');
    expect(editor).toContain('data-testid="campaign-editor-fix-sender"');

    // Exercise the current CTA's actual guard and action expressions. The
    // design step must stay reachable before subject/audience are ready; the
    // final review must still obey all send blockers. Literal JSX assertions
    // incorrectly required the old two-button toolbar after the workflow moved.
    const ast = ts.createSourceFile("editor.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const cta = elements.find((node) => node.attributes.properties.some((prop) =>
      ts.isJsxAttribute(prop) && prop.name.getText(ast) === "data-testid" &&
      prop.initializer && ts.isStringLiteral(prop.initializer) && prop.initializer.text === "campaign-editor-review-send-cta"));
    const expression = (element: typeof cta, name: string) => {
      const prop = element?.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(ast) === name);
      if (!prop || !ts.isJsxAttribute(prop) || !prop.initializer || !ts.isJsxExpression(prop.initializer) || !prop.initializer.expression) {
        throw new Error(`Missing ${name} expression`);
      }
      return prop.initializer.expression.getText(ast);
    };
    const disabled = new Function("campaignType", "reviewingNewsletter", "sendButtonDisabled", "isLocked", "pendingTemplateSave", `return (${expression(cta, "disabled")})`) as
      (channel: string, reviewing: boolean, blocked: boolean, locked: boolean, pending: unknown) => boolean;
    expect(disabled("email", false, true, false, null)).toBe(false);
    expect(disabled("email", false, false, true, null)).toBe(true);
    expect(disabled("email", false, false, false, {})).toBe(true);
    for (const [channel, reviewing] of [["email", true], ["sms", false]] as const) {
      expect(disabled(channel, reviewing, true, false, null)).toBe(true);
      expect(disabled(channel, reviewing, false, false, null)).toBe(false);
    }
    const actions: string[] = [];
    const click = new Function("campaignType", "reviewingNewsletter", "handleOpenStudio", "openSendConfirmation", `return (${expression(cta, "onClick")})`) as
      (channel: string, reviewing: boolean, design: () => void, review: () => void) => () => void;
    for (const [channel, reviewing] of [["email", false], ["email", true], ["sms", false]] as const) {
      click(channel, reviewing, () => actions.push("design"), () => actions.push("review"))();
    }
    expect(actions).toEqual(["design", "review", "review"]);
    const review = elements.find((node) => node.tagName.getText(ast) === "CampaignSendConfirmation");
    const schedule = new Function("setSendConfirmOpen", "handleScheduleForLater", `return (${expression(review, "onSchedule")})`) as
      (close: (open: boolean) => void, openSchedule: () => void) => () => void;
    const scheduling: string[] = [];
    schedule((open) => scheduling.push(`review:${open}`), () => scheduling.push("schedule"))();
    expect(scheduling).toEqual(["review:false", "schedule"]);
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
    expect(settings).not.toContain("isLocked || !draftEmail.trim()");
  });
});
