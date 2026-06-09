import { describe, expect, it } from "vitest";
import { renderStudioBlocksToEmailHtml } from "@/lib/studio/emailHtmlGenerator";

// Minimal block shape — the renderer treats unknown fields as undefined.
// We rely on TypeScript's structural typing via `as any` so we don't have to
// reconstruct the full StudioBlock interface here.
function textBlock(body: string) {
  return {
    id: "test-block",
    type: "plain-text" as const,
    body,
  } as any;
}

function spacerBlock(spacerHeight: number) {
  return {
    id: "test-spacer",
    type: "spacer" as const,
    spacerHeight,
  } as any;
}

describe("emailHtmlGenerator — text block compilation", () => {
  it("emits a bulleted list with email-safe inline styles", () => {
    const html = renderStudioBlocksToEmailHtml([
      textBlock("<ul><li>First</li><li>Second</li></ul>"),
    ]);

    expect(html).toContain("<ul ");
    expect(html).toMatch(/<ul[^>]*style="[^"]*margin:0 0 12px[^"]*"/);
    expect(html).toMatch(/<ul[^>]*style="[^"]*padding-left:24px[^"]*"/);
    expect(html).toMatch(/<ul[^>]*style="[^"]*list-style-type:disc[^"]*"/);
    expect(html).toMatch(/<li[^>]*style="[^"]*margin:0 0 4px[^"]*"/);
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  it("emits a numbered list with decimal style", () => {
    const html = renderStudioBlocksToEmailHtml([
      textBlock("<ol><li>One</li><li>Two</li><li>Three</li></ol>"),
    ]);

    expect(html).toContain("<ol ");
    expect(html).toMatch(/<ol[^>]*style="[^"]*list-style-type:decimal[^"]*"/);
    expect(html).toMatch(/<ol[^>]*style="[^"]*padding-left:24px[^"]*"/);
    expect(html).toContain("Three");
  });

  it("renders soft line breaks as self-closing <br /> for email-client safety", () => {
    const html = renderStudioBlocksToEmailHtml([
      textBlock("<p>Line one<br>Line two<br />Line three</p>"),
    ]);

    // All variants normalize to <br />
    expect(html).not.toMatch(/<br>/);
    expect(html.match(/<br \/>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Line one");
    expect(html).toContain("Line two");
    expect(html).toContain("Line three");
  });

  it("keeps soft line breaks inside the same paragraph (no <p> split)", () => {
    const html = renderStudioBlocksToEmailHtml([
      textBlock("<p>Line one<br>Line two</p>"),
    ]);

    const paragraphMatches = html.match(/<p\b[^>]*>/g) ?? [];
    expect(paragraphMatches.length).toBe(1);
  });

  it("preserves the 12px paragraph margin (existing default)", () => {
    const html = renderStudioBlocksToEmailHtml([
      textBlock("<p>One.</p><p>Two.</p>"),
    ]);

    const paragraphTags = html.match(/<p[^>]*>/g) ?? [];
    expect(paragraphTags.length).toBe(2);
    paragraphTags.forEach((tag) => {
      expect(tag).toContain("margin:0 0 12px");
    });
  });
});

describe("emailHtmlGenerator — Spacer block", () => {
  it("emits an explicit-height container so the gap is preserved in email", () => {
    const html = renderStudioBlocksToEmailHtml([spacerBlock(32)]);

    expect(html).toContain("height:32px");
    expect(html).toContain("line-height:32px");
    expect(html).toContain("font-size:32px");
    expect(html).toContain("&nbsp;");
  });

  it("falls back to the 32px default when no height is provided", () => {
    const html = renderStudioBlocksToEmailHtml([
      { id: "no-height", type: "spacer" } as any,
    ]);

    expect(html).toContain("height:32px");
  });

  it("respects custom heights for tight (8) and loose (64) spacers", () => {
    const tight = renderStudioBlocksToEmailHtml([spacerBlock(8)]);
    const loose = renderStudioBlocksToEmailHtml([spacerBlock(64)]);

    expect(tight).toContain("height:8px");
    expect(loose).toContain("height:64px");
  });
});
