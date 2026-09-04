import { describe, expect, it } from "vitest";
import { normalizePastedRichText } from "@/lib/studio/richTextPaste";

describe("normalizePastedRichText", () => {
  it("keeps portable formatting from copied documents", () => {
    const result = normalizePastedRichText(
      '<p style="text-align:center;font-weight:bold;font-family:Papyrus">Welcome <em>gardeners</em></p><ol><li>Choose a pot</li><li>Plant</li></ol>',
    );

    expect(result).toContain("text-align:center");
    expect(result).toContain("font-weight:bold");
    expect(result).not.toContain("font-family");
    expect(result).toContain("<em>gardeners</em>");
    expect(result).toContain("<ol>");
  });

  it("removes unsafe and unsupported clipboard content", () => {
    const result = normalizePastedRichText(
      '<script>alert(1)</script><img src="https://tracker.invalid/pixel"><p onclick="steal()">Safe <a href="javascript:alert(2)">link</a></p>',
    );

    expect(result).not.toMatch(/script|alert|onclick|<img|javascript:/i);
    expect(result).toContain("<p>Safe <a>link</a></p>");
  });
});
