import { describe, expect, it } from "vitest";
import type { ContentBlock } from "@/types/emailBuilder";
import {
  findEmptyBlocks,
  findIncompleteImageBlocks,
  findPlaceholderTextIssues,
  normalizeBuilderUrl,
  validateBlockBeforeSave,
  validateSubjectLine,
} from "@/lib/crm/campaignBuilderValidation";

function createBlock(overrides: Partial<ContentBlock>): ContentBlock {
  return {
    id: overrides.id || `block-${Math.random().toString(36).slice(2)}`,
    type: overrides.type || "text",
    source: overrides.source || "manual",
    ...overrides,
  };
}

describe("campaignBuilderValidation", () => {
  it("strips example.com placeholders and rejects unsafe URLs", () => {
    expect(normalizeBuilderUrl("https://example.com")).toMatchObject({
      sanitizedUrl: "",
      wasPlaceholder: true,
      isValid: false,
    });

    expect(normalizeBuilderUrl("javascript:alert(1)")).toMatchObject({
      sanitizedUrl: "",
      isValid: false,
    });

    expect(
      normalizeBuilderUrl("https://shop.example.org/path?x=1&amp;y=2")
        .sanitizedUrl,
    ).toBe("https://shop.example.org/path?x=1&y=2");
  });

  it("blocks saving CTA text without a valid button URL", () => {
    const result = validateBlockBeforeSave(
      createBlock({
        type: "button",
        buttonText: "Shop now",
        buttonUrl: "https://example.com",
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.buttonUrl).toBe(
      "Please enter a valid URL for this button",
    );
    expect(result.sanitizedBlock.buttonUrl).toBe("");
    expect(result.sanitizedBlock.ctaUrl).toBe("");
  });

  it("blocks saving image-primary blocks without an image", () => {
    const result = validateBlockBeforeSave(
      createBlock({
        type: "graphic-hero",
        imageUrl: "",
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.imageUrl).toBe(
      "Please add an image before saving this block",
    );
  });

  it("finds placeholder, blank, and missing-image builder issues", () => {
    const blocks: ContentBlock[] = [
      createBlock({
        type: "email-safe-hero",
        headline: "Hero headline",
        subtitle: "Add a concise supporting message.",
      }),
      createBlock({
        type: "text",
        title: "",
        content: "",
      }),
      createBlock({
        type: "image",
        layout: "full-width",
        imageUrl: "",
      }),
    ];

    const placeholderIssues = findPlaceholderTextIssues(blocks);
    const emptyBlocks = findEmptyBlocks(blocks);
    const incompleteImages = findIncompleteImageBlocks(blocks);

    expect(placeholderIssues).toHaveLength(2);
    expect(placeholderIssues[0]?.blockLabel).toContain("block #1");
    expect(emptyBlocks).toHaveLength(2);
    expect(incompleteImages).toHaveLength(1);
    expect(incompleteImages[0]?.detail).toContain("has no image");
  });

  it("warns on placeholder and overly long subject lines", () => {
    const placeholderResult = validateSubjectLine("Test", "email");
    const longResult = validateSubjectLine("A".repeat(61), "email");

    expect(placeholderResult.isPlaceholder).toBe(true);
    expect(placeholderResult.warnings).toContain(
      "Subject line still looks like placeholder text.",
    );
    expect(longResult.warnings).toContain(
      "Subject lines over 60 characters may be truncated in inboxes.",
    );
  });
});
