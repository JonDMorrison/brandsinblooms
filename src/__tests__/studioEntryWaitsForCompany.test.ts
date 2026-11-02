import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Clicking "Customize in Design Studio" before the company loads saved the
// draft against the signed-in user's own company. For an admin working in a
// client account the server refused it, so Design Studio never opened.
describe("Design Studio entry on a new newsletter", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/pages/crm/CRMCampaignEditorPage.tsx"), "utf8");

  it("uses the same company the draft save uses (the editor's), not a separate lookup", () => {
    const context = fs.readFileSync(path.join(process.cwd(), "src/components/crm/campaign-editor/CampaignEditorContext.tsx"), "utf8");
    expect(context).toContain("isTenantReady: Boolean(tenant?.id)");
  });

  it("stays disabled until the company is known", () => {
    expect(page).toMatch(/disabled=\{\s*isLocked \|\| Boolean\(pendingTemplateSave\) \|\| !isTenantReady\s*\}/);
    expect(page).toContain('"Loading your garden centre"');
  });

  it("never saves a draft before the company is known", () => {
    const handler = page.slice(page.indexOf("const handleOpenStudio"), page.indexOf("const handleScheduleForLater"));
    expect(handler.indexOf("if (!isTenantReady)")).toBeGreaterThan(-1);
    expect(handler.indexOf("if (!isTenantReady)")).toBeLessThan(handler.indexOf("saveDraft"));
  });
});
