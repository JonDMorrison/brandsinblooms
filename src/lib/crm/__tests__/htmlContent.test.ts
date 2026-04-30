import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatDraftRichText,
  formatDraftText,
} from "@/lib/crm/htmlContent";

describe("escapeHtml", () => {
  it("escapes the standard set of HTML metacharacters", () => {
    expect(escapeHtml(`<p class="a">&'</p>`)).toBe(
      "&lt;p class=&quot;a&quot;&gt;&amp;&#39;&lt;/p&gt;",
    );
  });

  it("treats null and undefined as empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("formatDraftText", () => {
  it("escapes HTML and converts newlines to <br />", () => {
    expect(formatDraftText("Hi\n<b>there</b>")).toBe(
      "Hi<br />&lt;b&gt;there&lt;/b&gt;",
    );
  });

  it("returns empty string for nullish input", () => {
    expect(formatDraftText(undefined)).toBe("");
  });
});

describe("formatDraftRichText", () => {
  it("passes through values that contain HTML tags unchanged", () => {
    const tiptapOutput =
      `<p style="text-align: left;">Hi friends</p><br><br><p>More copy here.</p>`;
    expect(formatDraftRichText(tiptapOutput)).toBe(tiptapOutput);
  });

  it("does not double-escape already-rendered TipTap HTML", () => {
    const tiptapOutput = `<p>"Quoted" & <em>emphasized</em></p>`;
    // Critical: must not produce &lt;p&gt; or &quot; — that's the bug we're fixing.
    expect(formatDraftRichText(tiptapOutput)).toBe(tiptapOutput);
  });

  it("escapes plain text that lacks HTML tags", () => {
    expect(formatDraftRichText('5 < 10 & "ok"')).toBe(
      "5 &lt; 10 &amp; &quot;ok&quot;",
    );
  });

  it("converts newlines in plain text but leaves HTML alone", () => {
    expect(formatDraftRichText("line one\nline two")).toBe(
      "line one<br />line two",
    );
  });

  it("does not treat stray angle brackets in plain text as tags", () => {
    // Tighter regex requirement: requires an actual tag name + word boundary.
    expect(formatDraftRichText("<3 days remaining")).toBe(
      "&lt;3 days remaining",
    );
    expect(formatDraftRichText("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("recognizes closing tags as HTML", () => {
    const value = "Hello </span>world";
    expect(formatDraftRichText(value)).toBe(value);
  });

  it("returns empty string for nullish input", () => {
    expect(formatDraftRichText(null)).toBe("");
    expect(formatDraftRichText(undefined)).toBe("");
  });
});
