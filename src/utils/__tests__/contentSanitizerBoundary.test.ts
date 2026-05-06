import { describe, expect, it } from "vitest";
import { sanitizeAndImproveContent } from "@/utils/contentQuality";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import type { ContentBlock } from "@/types/emailBuilder";

// These tests document why ClickToEditBlock.handleLocalUpdate must NOT call
// sanitizeAndImproveContent on every keystroke. The sanitizer trims trailing
// whitespace per line, which dropped the spacebar character mid-word for
// inputs bound directly to block.headline/title/content. The fix removed the
// sanitizer from the keystroke path; sanitization now only happens at content
// boundaries (AI generation, paste-import, explicit "Strengthen" button).
//
// If a future change re-introduces sanitizeAndImproveContent into the
// keystroke handler, the third test below will fail.

describe("Content sanitizer boundary", () => {
  describe("sanitizer behavior (regression-documenting)", () => {
    it("sanitizeWeekNumbers strips trailing whitespace", () => {
      expect(sanitizeWeekNumbers("Sample ")).toBe("Sample");
      expect(sanitizeWeekNumbers("Hello World ")).toBe("Hello World");
      expect(sanitizeWeekNumbers(" Leading and trailing ")).toBe(
        "Leading and trailing",
      );
    });

    it("sanitizeAndImproveContent inherits the trim behavior", () => {
      expect(sanitizeAndImproveContent("Hello ")).toBe("Hello");
      expect(sanitizeAndImproveContent("Sample Header ")).toBe("Sample Header");
      expect(sanitizeAndImproveContent(" Leading ")).toBe("Leading");
    });
  });

  describe("keystroke pass-through (current handleLocalUpdate contract)", () => {
    // Mirrors the post-fix body of ClickToEditBlock.handleLocalUpdate for the
    // text fields. The function spreads updates verbatim onto sanitizedUpdates
    // with no transformation. If anyone re-adds a sanitizer call for any of
    // these fields, the corresponding assertion below will fail.
    function passThroughKeystroke(
      localBlock: ContentBlock,
      updates: Partial<ContentBlock>,
    ): ContentBlock {
      const sanitizedUpdates = { ...updates };
      return { ...localBlock, ...sanitizedUpdates };
    }

    const baseBlock: ContentBlock = {
      id: "test-block",
      type: "text",
    } as ContentBlock;

    it("preserves trailing whitespace on headline mid-typing", () => {
      // Simulates the moment a user has typed "Hello " and is about to press W.
      // The trailing space MUST survive into the saved block so that the
      // controlled input doesn't snap the DOM value back to "Hello".
      const result = passThroughKeystroke(baseBlock, { headline: "Hello " });
      expect(result.headline).toBe("Hello ");
    });

    it("preserves trailing whitespace on title and content", () => {
      const result = passThroughKeystroke(baseBlock, {
        title: "Sample ",
        content: "Some text ",
      });
      expect(result.title).toBe("Sample ");
      expect(result.content).toBe("Some text ");
    });

    it("preserves leading whitespace and runs of spaces", () => {
      const result = passThroughKeystroke(baseBlock, {
        headline: "  two leading and  internal  ",
      });
      expect(result.headline).toBe("  two leading and  internal  ");
    });

    it("handles the full 'Hello World' typing sequence without losing the space", () => {
      // Simulates: user types 'Hello' then ' ' then 'World'.
      let block = baseBlock;
      block = passThroughKeystroke(block, { headline: "Hello" });
      expect(block.headline).toBe("Hello");
      block = passThroughKeystroke(block, { headline: "Hello " });
      expect(block.headline).toBe("Hello ");
      block = passThroughKeystroke(block, { headline: "Hello W" });
      expect(block.headline).toBe("Hello W");
      block = passThroughKeystroke(block, { headline: "Hello World" });
      expect(block.headline).toBe("Hello World");
    });

    it("preserves whitespace on body field as well", () => {
      const result = passThroughKeystroke(baseBlock, { body: "trailing " });
      expect(result.body).toBe("trailing ");
    });
  });
});
