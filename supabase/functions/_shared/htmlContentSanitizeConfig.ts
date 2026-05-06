// sanitize-html configuration for TipTap-emitted rich-text bodies.
//
// MUST stay in sync with src/lib/crm/htmlContentSanitizeConfig.ts. Both
// files configure the same library (sanitize-html v2) with the same
// allowlist so the draft preview HTML written into crm_campaigns.content
// matches the HTML the send pipeline emits from metadata.contentBlocks.
//
// Allowlist scope: covers TipTap's StarterKit + TextAlign + Underline
// extensions configured in src/components/ui-legacy/rich-text-editor.tsx,
// plus a few defensive aliases (b, i, strike) that paste sources sometimes
// emit. Style attribute values are constrained to a narrow CSS subset
// (text-align, color/background-color, font-weight/font-style,
// text-decoration). Hyperlink schemes are restricted to http, https,
// mailto. Anything outside the allowlist is stripped.

import type { IOptions } from "npm:sanitize-html@2.17.3";

const HEX_OR_RGB =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$|^rgba?\([^)]+\)$|^[a-z]+$/i;

export const RICH_TEXT_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    // block
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "hr",
    "div",
    "span",
    // inline marks
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    // links
    "a",
  ],

  allowedAttributes: {
    "*": ["class", "style"],
    a: ["href", "name", "target", "rel", "class", "style"],
  },

  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
  },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  allowProtocolRelative: false,

  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/i],
      color: [HEX_OR_RGB],
      "background-color": [HEX_OR_RGB],
      "font-weight": [/^(\d+|normal|bold|bolder|lighter)$/i],
      "font-style": [/^(normal|italic|oblique)$/i],
      "text-decoration": [
        /^(none|underline|overline|line-through|underline\s+overline)$/i,
      ],
    },
  },

  // Defense-in-depth: force rel="noopener noreferrer" on any <a target="_blank">.
  transformTags: {
    a: (
      tagName: string,
      attribs: Record<string, string>,
    ): { tagName: string; attribs: Record<string, string> } => {
      const next: Record<string, string> = { ...attribs };
      if (next.target === "_blank") {
        const existing = (next.rel || "").toLowerCase();
        const tokens = new Set(existing.split(/\s+/).filter(Boolean));
        tokens.add("noopener");
        tokens.add("noreferrer");
        next.rel = Array.from(tokens).join(" ").trim();
      }
      return { tagName, attribs: next };
    },
  },

  // Strip <script> bodies entirely (default). Strip the contents of
  // disallowed tags rather than leaving plain text in place — keeps emails
  // clean of stray "alert(1)" style strings if a <script> ever reaches us.
  disallowedTagsMode: "discard",
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};
