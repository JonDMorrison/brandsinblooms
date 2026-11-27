import { describe, expect, it } from "vitest";
import {
  draftPreviewText,
  draftInboxSuggestion,
  inboxInsights,
  newsletterInboxText,
  skipGreetingText,
  startsWithGreeting,
} from "./newsletterInbox";
import {
  buildInboxPrompt,
  parseInboxSuggestions,
  sanitizeInboxSuggestions,
  tidySuggestionText,
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
  it("never drafts preview text that starts with a greeting", () => {
    const greetings = [
      "Hi {{first_name}},",
      "Hello {{ first_name }}!",
      "Hey there,",
      "Dear friends,",
      "Good morning, gardeners!",
      "Hi Jane",
      "Hello and welcome to our garden centre",
    ];
    for (const greeting of greetings) {
      const draft = draftInboxSuggestion([
        "Winter wreath workshops",
        greeting,
        "Join us on November 14 for a hands-on workshop.",
      ]);
      expect(startsWithGreeting(draft.preview)).toBe(false);
      expect(draft.preview).toBe("Join us on November 14 for a hands-on workshop.");
    }
  });
  it("keeps the news after a greeting in the same line", () => {
    expect(
      draftInboxSuggestion([
        "Winter wreaths",
        "Hi {{first_name}}, our wreath workshops are back. Book a seat today.",
      ]).preview,
    ).toBe("Our wreath workshops are back. Book a seat today.");
    expect(skipGreetingText("Good morning! Fresh poinsettias arrived today.")).toBe(
      "Fresh poinsettias arrived today.",
    );
    expect(skipGreetingText("Hello there. Hi again. Roses are 20% off.")).toBe(
      "Roses are 20% off.",
    );
  });
  it("leaves the preview empty when the copy is only greetings", () => {
    expect(
      draftInboxSuggestion(["Winter wreaths", "Hi {{first_name}},", "Dear friends,"]).preview,
    ).toBe("");
    expect(draftInboxSuggestion(["Hello {{first_name}}!"]).preview).toBe("");
  });
  it("does not treat words that only begin like a greeting as one", () => {
    expect(startsWithGreeting("Hi-tech grow lights are here")).toBe(false);
    expect(startsWithGreeting("Heyday of the hellebores")).toBe(false);
    expect(startsWithGreeting("Helloween pumpkin sale")).toBe(false);
    expect(
      draftInboxSuggestion(["Lights", "Hi-tech grow lights are here."]).preview,
    ).toBe("Hi-tech grow lights are here.");
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
  it("asks for subjects under 60 characters with no em dashes or exclamation marks", () => {
    const prompt = buildInboxPrompt({ content: "Wreaths" });
    expect(prompt).toContain("40 to 59 characters, never 60 or more");
    expect(prompt).toContain("Never use em dashes or exclamation marks");
  });
  it("fixes em dashes and exclamation marks, and drops subjects of 60 or more", () => {
    expect(tidySuggestionText("Wreaths are back — book now!")).toBe("Wreaths are back, book now");
    expect(tidySuggestionText("Roses are in! Come and see")).toBe("Roses are in. Come and see");
    expect(tidySuggestionText("Fresh trees!!")).toBe("Fresh trees");
    expect(tidySuggestionText("Is it spring yet!?")).toBe("Is it spring yet?");
    expect(tidySuggestionText("Plants--now in")).toBe("Plants, now in");
    const kept = sanitizeInboxSuggestions([
      { subject: "Wreath workshops — book your seat!", preview: "Classes start November 14!" },
      { subject: "B".repeat(59), preview: "Fits" },
      { subject: "C".repeat(60), preview: "Too long" },
      { subject: "", preview: "No subject" },
      { subject: "No preview", preview: "" },
      { subject: "wreath workshops, book your seat", preview: "Duplicate" },
      "not a pair",
    ]);
    expect(kept).toEqual([
      { subject: "Wreath workshops, book your seat", preview: "Classes start November 14" },
      { subject: "B".repeat(59), preview: "Fits" },
    ]);
    for (const pair of kept) {
      expect(pair.subject.length).toBeLessThan(60);
      expect(`${pair.subject} ${pair.preview}`).not.toMatch(/[—!]/);
    }
    // Model output with nothing usable is an error, never invented text.
    expect(() =>
      parseInboxSuggestions(JSON.stringify({ suggestions: [{ subject: "D".repeat(70), preview: "x" }] })),
    ).toThrow();
  });
});

describe("preview text drafted from the design", () => {
  const block = (patch: Record<string, unknown>) =>
    ({ id: "b", type: "plain-text", label: "Text", order: 0, visible: true, ...patch }) as StudioBlock;
  it("uses the first sentence of the first text block", () => {
    expect(
      draftPreviewText([
        block({ type: "newsletter-header", body: "Northfield Garden Centre" }),
        block({ type: "email-safe-hero", headline: "Winter wreaths", body: "<p>Our workshops are back. Book a seat today.</p>" }),
        block({ body: "Later copy." }),
      ]),
    ).toBe("Our workshops are back.");
  });
  it("strips a leading greeting, with or without a merge tag", () => {
    for (const greeting of ["Hi", "Hello", "Hey", "Dear", "Good morning", "Hi {{first_name}}", "Hello {{ first_name }}", "Dear {{first_name}}"]) {
      expect(draftPreviewText([block({ body: `${greeting}, roses are 20% off this week. Come early.` })])).toBe(
        "Roses are 20% off this week.",
      );
    }
    expect(draftPreviewText([block({ body: "<p>Hi {{first_name}},</p><p>Poinsettias arrived today. More soon.</p>" })])).toBe(
      "Poinsettias arrived today.",
    );
  });
  it("leaves it empty when only a greeting is left or there is no text", () => {
    expect(draftPreviewText([block({ body: "Hi {{first_name}}," }), block({ body: "Other news." })])).toBe("");
    expect(draftPreviewText([block({ body: "Good morning!" })])).toBe("");
    expect(draftPreviewText([block({ type: "footer", body: "Unsubscribe" })])).toBe("");
    expect(draftPreviewText([])).toBe("");
  });
});
