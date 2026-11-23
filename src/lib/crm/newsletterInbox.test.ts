import { describe, expect, it } from "vitest";
import {
  draftInboxSuggestion,
  inboxInsights,
  newsletterInboxText,
} from "./newsletterInbox";
import {
  buildInboxPrompt,
  parseInboxSuggestions,
} from "../../../supabase/functions/generate-subject-lines/suggestions";
import type { StudioBlock } from "@/types/studioBlocks";

describe("content-first inbox suggestions", () => {
  it("uses visible newsletter copy and ignores compliance and placeholders", () => {
    const blocks = [
      { type: "footer", body: "Unsubscribe at this address" },
      {
        type: "hero",
        headline: "Winter wreath workshops",
        body: "Join us on November 14 for a hands-on workshop.",
      },
      { type: "plain-text", body: "Secret hidden offer", visible: false },
      { type: "hero", headline: "Newsletter Title" },
    ] as StudioBlock[];
    const lines = newsletterInboxText(blocks);
    expect(lines).toEqual([
      "Winter wreath workshops",
      "Join us on November 14 for a hands-on workshop.",
    ]);
    expect(draftInboxSuggestion(lines)).toEqual({
      subject: lines[0],
      preview: lines[1],
    });
  });
  it("does not invent a subject before there is content", () => {
    expect(draftInboxSuggestion([])).toEqual({ subject: "", preview: "" });
  });
  it("checks inbox readability without promising performance", () => {
    expect(
      inboxInsights("A".repeat(90), "A".repeat(170)).length,
    ).toBeGreaterThan(1);
  });
  it("grounds the prompt in content even when a generic topic exists", () => {
    const prompt = buildInboxPrompt({
      topic: "Untitled campaign",
      content: "Wreath workshop November 14",
      subject: "My subject",
    });
    expect(prompt).toContain('"newsletter":"Wreath workshop November 14"');
    expect(prompt).toContain('"currentSubject":"My subject"');
    expect(prompt).toContain("Do not invent discounts");
    expect(prompt).toContain("lead with the benefit");
    expect(prompt).toContain("Do not write a botanical description");
    expect(prompt).not.toContain("explain");
    expect(prompt).not.toContain('"reason"');
  });
  it("validates pairs and rejects incomplete model output", () => {
    const pair = {
      subject: "Wreath workshops are here",
      preview: "Join our hands-on class on November 14.",
    };
    expect(
      parseInboxSuggestions(JSON.stringify({ suggestions: [pair] })),
    ).toEqual([pair]);
    // A reason from an older model response is ignored, never shown.
    expect(
      parseInboxSuggestions(JSON.stringify({ suggestions: [{ ...pair, reason: "Because." }] })),
    ).toEqual([pair]);
    expect(() =>
      parseInboxSuggestions('{"suggestions":[{"subject":"Incomplete"}]}'),
    ).toThrow();
  });
});
