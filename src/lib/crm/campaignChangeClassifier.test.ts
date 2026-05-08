import { describe, expect, it } from "vitest";
import { classifyExternalCampaignChange } from "./campaignChangeClassifier";

const sampleBlock = (id: string, body: string) => ({
  id,
  type: "plain-text",
  body,
  visible: true,
  order: 0,
});

describe("classifyExternalCampaignChange", () => {
  it("returns metadata_only/info when only status moves and content is identical", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Hello</p>",
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [sampleBlock("a", "Hello")],
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      hasUnsavedLocalChanges: false,
    });

    expect(result.scenario).toBe("metadata_only");
    expect(result.severity).toBe("info");
    expect(result.localChangesAtRisk).toBe(false);
    expect(result.reason).toBe("metadata_generic");
  });

  it("recognises stuck_send_recovery as a tailored info message", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Hello</p>",
        metadata: {
          contentBlocks: [sampleBlock("a", "Hello")],
          stuck_send_recovery: { reset_at: "2026-05-06T22:00:00Z" },
        },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [sampleBlock("a", "Hello")],
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      hasUnsavedLocalChanges: true,
    });

    expect(result.scenario).toBe("metadata_only");
    expect(result.severity).toBe("info");
    expect(result.reason).toBe("stuck_send_recovery");
    // Even with unsaved local edits, stuck_send_recovery is metadata-only
    // so reload is non-destructive on content (only the displayed status
    // changes). localChangesAtRisk reflects content risk, not status.
    expect(result.localChangesAtRisk).toBe(false);
    expect(result.message).toMatch(/reset to draft/i);
  });

  it("recognises audit_correction keys (any namespace) as support corrections", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Hello</p>",
        metadata: {
          contentBlocks: [sampleBlock("a", "Hello")],
          audit_correction_footer_address: { corrected_at: "now" },
        },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [sampleBlock("a", "Hello")],
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      hasUnsavedLocalChanges: false,
    });

    expect(result.scenario).toBe("metadata_only");
    expect(result.severity).toBe("info");
    expect(result.reason).toBe("audit_correction");
    expect(result.message).toMatch(/support/i);
  });

  it("returns content_no_local/warning when blocks change and there are no local edits", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Updated</p>",
        metadata: { contentBlocks: [sampleBlock("a", "Updated")] },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [sampleBlock("a", "Hello")],
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      hasUnsavedLocalChanges: false,
    });

    expect(result.scenario).toBe("content_no_local");
    expect(result.severity).toBe("warning");
    expect(result.localChangesAtRisk).toBe(false);
    expect(result.reason).toBe("content_changed");
  });

  it("returns content_with_local/warning when blocks change AND user has unsaved edits", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Updated</p>",
        metadata: { contentBlocks: [sampleBlock("a", "Updated")] },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [sampleBlock("a", "Hello")],
        metadata: { contentBlocks: [sampleBlock("a", "Hello")] },
      },
      hasUnsavedLocalChanges: true,
    });

    expect(result.scenario).toBe("content_with_local");
    expect(result.severity).toBe("warning");
    expect(result.localChangesAtRisk).toBe(true);
    expect(result.detail).toMatch(/lost on reload/i);
  });

  it("treats block reordering or deep-property changes as content changes", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Hello</p>",
        metadata: {
          contentBlocks: [
            { ...sampleBlock("a", "Hello"), buttonColor: "#ff0000" },
          ],
        },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [
          { ...sampleBlock("a", "Hello"), buttonColor: "#000000" },
        ],
        metadata: {},
      },
      hasUnsavedLocalChanges: false,
    });

    expect(result.scenario).toBe("content_no_local");
    expect(result.severity).toBe("warning");
  });

  it("ignores pure key reordering inside contentBlocks (stable stringify)", () => {
    const result = classifyExternalCampaignChange({
      incomingRow: {
        content: "<p>Hello</p>",
        metadata: {
          // Same data, different key order
          contentBlocks: [
            {
              order: 0,
              type: "plain-text",
              id: "a",
              body: "Hello",
              visible: true,
            },
          ],
        },
      },
      lastKnownRecord: {
        content: "<p>Hello</p>",
        contentBlocks: [
          {
            id: "a",
            type: "plain-text",
            body: "Hello",
            visible: true,
            order: 0,
          },
        ],
        metadata: {},
      },
      hasUnsavedLocalChanges: false,
    });

    expect(result.scenario).toBe("metadata_only");
  });
});
