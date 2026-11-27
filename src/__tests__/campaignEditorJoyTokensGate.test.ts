import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The campaign editor takes every colour, font and radius from the Joy theme
 * (src/config/joy-theme.ts). These are the editor page and its own
 * components. Email renderers (campaignPreviewHtml, emailHtmlGenerator, the
 * studio block renderers) are customer email content and are not listed.
 */
const EDITOR_FILES = [
  "src/pages/crm/CRMCampaignEditorPage.tsx",
  "src/components/crm/campaign-editor/campaignEditorTheme.ts",
  "src/components/crm/campaign-editor/CampaignEditorStep.tsx",
  "src/components/crm/campaign-editor/CampaignReadinessBar.tsx",
  "src/components/crm/campaign-editor/CampaignLivePreview.tsx",
  "src/components/crm/campaign-editor/CampaignDesignSummary.tsx",
  "src/components/crm/campaign-editor/CampaignSenderStep.tsx",
  "src/components/crm/campaign-editor/NewsletterInboxReview.tsx",
  "src/components/crm/campaign-editor/ContentPreviewCard.tsx",
];

const RULES: Array<{ name: string; pattern: RegExp }> = [
  // #abc, #abcd, #aabbcc, #aabbccdd as a whole token (not "#add-block").
  {
    name: "hex colour",
    pattern: /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi,
  },
  { name: "rgb()/rgba()/hsl()/hsla() colour", pattern: /\b(?:rgba?|hsla?)\(/gi },
  // A font set by name, in sx/style objects or JSX props...
  { name: "fontFamily string", pattern: /\bfontFamily\s*(?::\s*["'`]|=)/g },
  // ...or in CSS text, unless it points at a Joy font variable.
  {
    name: "font-family value",
    pattern: /\bfont-family\s*:\s*(?!var\(--joy-fontFamily-)/gi,
  },
  { name: "px border radius", pattern: /\bborderRadius\s*:\s*(?:["'`]\d+(?:\.\d+)?px|\d)/g },
  // Page-local re-pointing of Joy palette variables.
  { name: "Joy palette variable override", pattern: /["'`]--joy-palette-[\w-]+["'`]\s*:/g },
];

function findViolations(source: string) {
  const found: string[] = [];
  for (const { name, pattern } of RULES) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      found.push(`${name} at line ${line}: ${match[0]}`);
    }
  }
  return found;
}

describe("campaign editor uses Joy theme tokens only", () => {
  it.each(EDITOR_FILES)("%s has no hard-coded colour, font family or px radius", (path) => {
    expect(findViolations(readFileSync(path, "utf8"))).toEqual([]);
  });

  it("fails on each kind of hard-coded value", () => {
    const samples: Record<string, string> = {
      "hex colour": `sx={{ bgcolor: "#F6F5F1", color: "#fff", borderColor: "#1F4D3AFF" }}`,
      "rgb()/rgba()/hsl()/hsla() colour": `sx={{ bgcolor: "rgba(31, 77, 58, 0.06)", color: "hsl(0 0% 0%)" }}`,
      "fontFamily string": `sx={{ fontFamily: "Georgia, 'Times New Roman', serif" }}`,
      "font-family value": `const css = "h1{font-family:Fraunces,serif}";`,
      "px border radius": `sx={{ borderRadius: "14px" }}`,
      "Joy palette variable override": `const vars = { "--joy-palette-primary-500": value };`,
    };
    for (const [rule, sample] of Object.entries(samples)) {
      const violations = findViolations(sample);
      expect(violations.length, `${rule}: ${sample}`).toBeGreaterThan(0);
      expect(violations.every((violation) => violation.startsWith(rule))).toBe(true);
    }
    expect(findViolations(`<Box sx={{ borderRadius: 2 }} />`)).toHaveLength(1);
    expect(findViolations(`<Typography fontFamily="Inter" />`)).toHaveLength(1);
  });

  it("allows Joy tokens, theme variables and ids that look like hex", () => {
    const clean = [
      `sx={{ bgcolor: "background.surface", color: "text.secondary", borderColor: "divider" }}`,
      `sx={{ borderRadius: "lg", outline: "3px solid var(--joy-palette-primary-500)" }}`,
      "sx={(theme) => ({ fontFamily: theme.vars.fontFamily.display })}",
      "href={`#${section}`} data-target=\"#add-block\"",
      `const css = "p{font-family:var(--joy-fontFamily-body)}";`,
      `sx={{ borderRadius: "50%" }}`,
    ].join("\n");
    expect(findViolations(clean)).toEqual([]);
  });
});
