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
  it("preserves typical TipTap output (paragraph with text-align style)", () => {
    // sanitize-html's CSS parser normalizes style values: it removes
    // whitespace around the colon and trailing semicolons. This is cosmetic
    // and visually equivalent. The semantic content (left alignment) is
    // preserved.
    const tiptapOutput =
      `<p style="text-align: left;">Hi friends</p><p>More copy here.</p>`;
    const out = formatDraftRichText(tiptapOutput);
    expect(out).toBe(`<p style="text-align:left">Hi friends</p><p>More copy here.</p>`);
    // Semantic guarantees:
    expect(out).toContain("text-align");
    expect(out).toContain("left");
    expect(out).toContain("Hi friends");
    expect(out).toContain("More copy here.");
  });

  it("preserves common TipTap marks (bold, italic, underline)", () => {
    const tiptapOutput =
      `<p><strong>bold</strong> and <em>italic</em> and <u>underline</u></p>`;
    expect(formatDraftRichText(tiptapOutput)).toBe(tiptapOutput);
  });

  it("preserves headings and lists", () => {
    const tiptapOutput =
      `<h2>Heading</h2><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>`;
    expect(formatDraftRichText(tiptapOutput)).toBe(tiptapOutput);
  });

  it("preserves a TipTap link with http href", () => {
    const tiptapOutput = `<p><a href="https://example.com">click</a></p>`;
    expect(formatDraftRichText(tiptapOutput)).toBe(tiptapOutput);
  });

  it("does not double-escape already-rendered TipTap HTML", () => {
    const tiptapOutput = `<p>"Quoted" &amp; <em>emphasized</em></p>`;
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
    expect(formatDraftRichText("<3 days remaining")).toBe(
      "&lt;3 days remaining",
    );
    expect(formatDraftRichText("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("returns empty string for nullish input", () => {
    expect(formatDraftRichText(null)).toBe("");
    expect(formatDraftRichText(undefined)).toBe("");
  });

  // ===== XSS / sanitizer tests =====

  it("strips <script> tags AND their contents", () => {
    const out = formatDraftRichText(`<p>before</p><script>alert(1)</script><p>after</p>`);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>before</p>");
    expect(out).toContain("<p>after</p>");
  });

  it("strips inline event handlers like onerror, onclick, onload", () => {
    const out = formatDraftRichText(
      `<p onclick="alert(1)">hi</p><p onmouseover="alert(2)">there</p>`,
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).not.toContain("alert");
  });

  it("strips <img> entirely (not in allowlist) — including malicious onerror", () => {
    const out = formatDraftRichText(
      `<p>before</p><img src="x" onerror="alert(1)" /><p>after</p>`,
    );
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("strips javascript: hrefs from anchor tags", () => {
    const out = formatDraftRichText(
      `<a href="javascript:alert(1)">click</a>`,
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("click");
  });

  it("strips vbscript: and data: hrefs from anchor tags", () => {
    expect(
      formatDraftRichText(`<a href="vbscript:msgbox(1)">x</a>`),
    ).not.toContain("vbscript:");
    expect(
      formatDraftRichText(`<a href="data:text/html,<script>alert(1)</script>">x</a>`),
    ).not.toContain("data:");
  });

  it("strips <iframe>, <object>, <embed>, <form>, <input>", () => {
    const samples = [
      `<iframe src="https://evil"></iframe>`,
      `<object data="https://evil"></object>`,
      `<embed src="https://evil" />`,
      `<form action="https://evil"><input name="x" /></form>`,
    ];
    for (const html of samples) {
      const out = formatDraftRichText(html);
      expect(out).not.toMatch(/<(iframe|object|embed|form|input)\b/);
    }
  });

  it("preserves allowed inline style properties", () => {
    const out = formatDraftRichText(
      `<p style="text-align: center; color: #ff6600;">styled</p>`,
    );
    expect(out).toContain("text-align");
    expect(out).toContain("center");
    expect(out).toContain("color");
    // Hex value preserved (sanitize-html may lowercase the property name)
    expect(out).toMatch(/#ff6600/i);
  });

  it("strips style declarations with javascript: URLs", () => {
    const out = formatDraftRichText(
      `<p style="background: url(javascript:alert(1))">x</p>`,
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("alert");
  });

  it("strips disallowed CSS properties (e.g., position, behavior)", () => {
    const out = formatDraftRichText(
      `<p style="position: absolute; behavior: url(xss.htc); color: #000000;">x</p>`,
    );
    expect(out).not.toContain("position");
    expect(out).not.toContain("behavior");
    // The allowed property survives.
    expect(out).toContain("color");
  });

  it("forces rel=noopener noreferrer on target=_blank anchors", () => {
    const out = formatDraftRichText(
      `<p><a href="https://example.com" target="_blank">click</a></p>`,
    );
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it("does not add rel attribute for anchors without target=_blank", () => {
    const out = formatDraftRichText(
      `<p><a href="https://example.com">click</a></p>`,
    );
    expect(out).not.toContain("rel=");
  });

  it("strips <style> tag bodies", () => {
    const out = formatDraftRichText(
      `<style>body{display:none}</style><p>visible</p>`,
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("display:none");
    expect(out).toContain("<p>visible</p>");
  });

  it("keeps newlines from rich-text content unchanged (sanitizer does not run on plain text)", () => {
    // Plain text path — sanitizer is not invoked, so no normalization.
    expect(formatDraftRichText("first\nsecond")).toBe("first<br />second");
  });
});
