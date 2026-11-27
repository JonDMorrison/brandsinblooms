import { describe, expect, it } from "vitest";
import {
  LINK_FIELD_ERROR,
  hasDangerousLinkScheme,
  isLinkMergeTag,
  normalizeLinkUrl,
  validateLinkUrl,
} from "@/lib/email/linkValidation";
import { safeEmailUrl } from "@/lib/studio/newsletter/settings";

describe("validateLinkUrl", () => {
  it.each([
    ["https://yourstore.com", "web"],
    ["http://yourstore.com/sale?x=1#top", "web"],
    ["HTTPS://Shop.Example.com/path", "web"],
    ["shop.example.com", "web"],
    ["www.shop.com/spring", "web"],
    ["mailto:hello@yourstore.com", "email"],
    ["mailto:hello@yourstore.com?subject=Hi", "email"],
    ["tel:+15551234567", "phone"],
    ["tel:555-123-4567", "phone"],
    ["{{company.website}}", "merge-tag"],
    ["{{ system.unsubscribe_url }}", "merge-tag"],
    ["{{system.preferences_url}}", "merge-tag"],
    ["{{unsubscribe_url}}", "merge-tag"],
    ["{{unsubscribeUrl}}", "merge-tag"],
  ])("accepts %s", (value, kind) => {
    const result = validateLinkUrl(value);
    expect(result).toMatchObject({ status: "valid", kind });
  });

  it("gives the https:// address for a bare domain", () => {
    expect(validateLinkUrl("shop.example.com")).toEqual({
      status: "valid",
      kind: "web",
      href: "https://shop.example.com/",
    });
  });

  it.each([
    "www shop",
    "htp://x",
    "http://x",
    "https://",
    "https://localhost",
    "https://shop",
    "https://user:pass@shop.com",
    "ftp://shop.com",
    "//shop.com",
    "/sale",
    "#",
    "shop",
    "mailto:",
    "mailto:not-an-address",
    "tel:",
    "tel:12",
    "tel:call me",
    "https://shop.com/a b",
    "{{first_name}}",
    "{{UNSUBSCRIBE_URL}}",
    "{{company.website}}/shop",
    "{{ company.website",
  ])("rejects %s with the inline message", (value) => {
    expect(validateLinkUrl(value)).toEqual({
      status: "invalid",
      message: LINK_FIELD_ERROR,
    });
  });

  it.each(["", "   ", null, undefined])("reports %p as empty", (value) => {
    expect(validateLinkUrl(value)).toMatchObject({ status: "empty" });
  });
});

describe("dangerous schemes", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\u0000script:alert(1)",
    "java\u200bscript:alert(1)",
    "jav&#x61;script:alert(1)",
    "jav&#97;script:alert(1)",
    "javascript&colon;alert(1)",
    "&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)",
    "%6A%61%76%61%73%63%72%69%70%74:alert(1)",
    "%256Aavascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "DATA:text/html,hi",
    "vbscript:msgbox(1)",
    "VbScript:msgbox(1)",
  ])("always rejects %s", (value) => {
    expect(hasDangerousLinkScheme(value)).toBe(true);
    const result = validateLinkUrl(value);
    expect(result).toMatchObject({ status: "unsafe" });
  });

  it("does not mistake an ordinary link that mentions a scheme", () => {
    expect(hasDangerousLinkScheme("https://shop.com/?next=javascript:void")).toBe(false);
    expect(validateLinkUrl("https://shop.com/data:sheet")).toMatchObject({ status: "valid" });
  });

  it("is never normalized into a web link", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});

describe("normalizeLinkUrl", () => {
  it.each([
    ["shop.example.com", "https://shop.example.com"],
    ["  shop.example.com/sale  ", "https://shop.example.com/sale"],
    ["www.shop.com", "https://www.shop.com"],
    ["https://shop.com", "https://shop.com"],
    ["http://shop.com", "http://shop.com"],
    ["mailto:hi@shop.com", "mailto:hi@shop.com"],
    ["{{company.website}}", "{{company.website}}"],
    ["www shop", "www shop"],
    ["htp://x", "htp://x"],
    ["", ""],
  ])("turns %p into %p", (value, expected) => {
    expect(normalizeLinkUrl(value)).toBe(expected);
  });
});

describe("link merge tags in the email", () => {
  it("knows only the link tags the merge engine fills in", () => {
    expect(isLinkMergeTag("{{ company.website }}")).toBe(true);
    expect(isLinkMergeTag("{{first_name}}")).toBe(false);
    expect(isLinkMergeTag("https://shop.com")).toBe(false);
  });

  it("keeps a link tag in a link so it is filled in at send time", () => {
    expect(safeEmailUrl("{{ system.unsubscribe_url }}")).toBe("{{ system.unsubscribe_url }}");
    expect(safeEmailUrl("{{company.website}}")).toBe("{{company.website}}");
  });

  it("never keeps a tag as an image address or any other tag as a link", () => {
    expect(safeEmailUrl("{{company.website}}", true)).toBe("");
    expect(safeEmailUrl("{{first_name}}")).toBe("");
    expect(safeEmailUrl("javascript:alert(1)")).toBe("");
  });
});
