import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Design Studio chrome (buttons, tabs, selection and focus rings) takes its
 * accent from the Joy primary palette (navy), not the old hard-coded greens.
 * Email content (block renderers, tenant brand colours) is not checked here.
 */
const OLD_STUDIO_GREENS = /#(?:244d46|183c35|234b49|254b49|315f53|315c58|34554f|e8f0eb|e5eeed|1f5b63)\b|rgba\(\s*31\s*,\s*91\s*,\s*99\b/gi;

const STUDIO_CHROME_FILES = [
  "src/components/crm/studio/StudioTopBar.tsx",
  "src/components/crm/studio/BlockLibrary.tsx",
  "src/components/crm/studio/StudioPreviewDialog.tsx",
  "src/components/crm/studio/newsletter/newsletterControls.css",
  "src/components/crm/studio/newsletter/ExtendedBlockProperties.tsx",
  "src/components/crm/campaign-editor/StudioCtaCard.tsx",
  "src/components/crm/campaign-editor/IntentPicker.tsx",
  "src/components/newsletter/YourTemplatesSection.tsx",
  "src/components/newsletter/CopyPreviousEmailDialog.tsx",
];

// Files with no colour literal at all: every colour is a Joy token.
const TOKEN_ONLY_FILES = [
  "src/components/crm/studio/BlockLibrary.tsx",
  "src/components/crm/campaign-editor/StudioCtaCard.tsx",
  "src/components/crm/campaign-editor/IntentPicker.tsx",
];
const ANY_HEX = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;

describe("Design Studio chrome uses the Joy primary palette", () => {
  it.each(STUDIO_CHROME_FILES)("%s has none of the old Studio greens", (path) => {
    expect(readFileSync(path, "utf8").match(OLD_STUDIO_GREENS) ?? []).toEqual([]);
  });

  it.each(TOKEN_ONLY_FILES)("%s has no hard-coded hex colour", (path) => {
    expect(readFileSync(path, "utf8").match(ANY_HEX) ?? []).toEqual([]);
  });

  it("the Review & Send button is a Joy primary solid button", () => {
    const source = readFileSync("src/components/crm/studio/StudioTopBar.tsx", "utf8");
    const button = source.slice(source.indexOf("<Button", source.indexOf('campaignStatus === "Draft" ? (')));
    const props = button.slice(0, button.indexOf(">"));
    expect(props).toContain('variant="solid"');
    expect(props).toContain('color="primary"');
  });

  it("the shared .nl-action button uses primary solid tokens", () => {
    const css = readFileSync("src/components/crm/studio/newsletter/newsletterControls.css", "utf8");
    const rule = css.slice(css.indexOf(".nl-action {"), css.indexOf("}", css.indexOf(".nl-action {")));
    expect(rule).toContain("var(--joy-palette-primary-solidBg)");
    expect(rule).toContain("var(--joy-palette-primary-solidColor)");
  });
});
