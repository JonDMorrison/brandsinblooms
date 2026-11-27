import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as ts from "typescript";

const source = (path: string) => readFileSync(path, "utf8");

describe("campaign sending design and palette invariants", () => {
  it("orders campaign steps and keeps sending behind permission and confirmation", () => {
    const editor = source("src/pages/crm/CRMCampaignEditorPage.tsx");
    // Design, Inbox, Audience, Sender, Organize (the header holds the actions).
    const positions = ["actions", "content", "inbox", "audience", "sender", "organize"].map(id => editor.indexOf(`id="campaign-editor-${id}"`));
    expect(positions.every(position => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a,b) => a-b));
    const ast = ts.createSourceFile("editor.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findByTestId = (testId: string) => {
      let found: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;
      const visit = (node: ts.Node) => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ast) === "data-testid" && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text === testId)) found = node;
        ts.forEachChild(node, visit);
      };
      visit(ast);
      return found;
    };
    const expressionOf = (element: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined, name: string) => {
      const prop = element?.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === name) as ts.JsxAttribute;
      return ((prop.initializer as ts.JsxExpression).expression!).getText(ast);
    };
    // The header's Schedule button is the way to send: it opens the schedule
    // drawer, whose "Send now" and "Schedule" both go through the confirmation.
    const cta = findByTestId("campaign-editor-schedule-cta");
    // The button and the drawer share one gate, which also waits for the
    // server email eligibility check (docs/email-eligibility.md).
    expect(expressionOf(cta, "disabled")).toBe("sendControlsDisabled");
    let gate: ts.Expression | undefined;
    const findGate = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "sendControlsDisabled") gate = node.initializer;
      ts.forEachChild(node, findGate);
    };
    findGate(ast);
    const disabled = (patch: Record<string, unknown> = {}) => {
      const values = {
        isLocked: false, canSendCampaign: true, pendingTemplateSave: null, sendBlockers: [],
        eligibilityChecking: false, campaignType: "email", isAudienceLoading: false, ...patch,
      };
      return new Function(...Object.keys(values), `return (${gate!.getText(ast)})`)(...Object.values(values));
    };
    expect(disabled()).toBe(false);
    expect(disabled({ isLocked: true })).toBe(true);
    expect(disabled({ canSendCampaign: false })).toBe(true);
    expect(disabled({ pendingTemplateSave: {} })).toBe(true);
    // #10: the button waits until every blocker in the checklist is fixed.
    expect(disabled({ sendBlockers: [{ message: "Add a subject line" }] })).toBe(true);
    // ...and until the eligibility check has returned.
    expect(disabled({ eligibilityChecking: true })).toBe(true);
    expect(expressionOf(cta, "onClick")).toBe("handleScheduleForLater");
    let drawer: ts.JsxSelfClosingElement | undefined;
    const findDrawer = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "CampaignScheduleDrawer") drawer = node;
      ts.forEachChild(node, findDrawer);
    };
    findDrawer(ast);
    const schedule = vi.fn(), review = vi.fn();
    new Function("updateSchedule", "openSendConfirmation", `return (${expressionOf(drawer, "onSendNow")})`)(schedule, review)();
    expect(schedule).toHaveBeenCalledWith({sendImmediately: true, sendAt: null});
    expect(review).toHaveBeenCalledOnce();
    expect(expressionOf(drawer, "canConfirm")).toBe("!sendControlsDisabled");
    expect(expressionOf(drawer, "checking")).toBe("eligibilityChecking");
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
