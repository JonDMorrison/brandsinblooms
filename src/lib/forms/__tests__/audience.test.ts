import { describe, expect, it } from "vitest";

import { normalizeFormAudience, segmentAssignmentProblem } from "../audience";

describe("normalizeFormAudience", () => {
  it("keeps the automatic segment selection through load, save and duplicate", () => {
    expect(
      normalizeFormAudience({
        assign_personas: ["persona-1"],
        assign_tags: ["tag-1"],
        segment_ids: ["segment-retail", "segment-wholesale", "segment-retail"],
      }),
    ).toEqual({
      assign_personas: ["persona-1"],
      assign_tags: ["tag-1"],
      segment_ids: ["segment-retail", "segment-wholesale"],
    });
  });

  it("returns empty lists for a missing or malformed value", () => {
    const empty = { assign_personas: [], assign_tags: [], segment_ids: [] };
    expect(normalizeFormAudience(null)).toEqual(empty);
    expect(normalizeFormAudience([])).toEqual(empty);
    expect(normalizeFormAudience({ segment_ids: "segment-retail" })).toEqual(
      empty,
    );
    expect(normalizeFormAudience({ segment_ids: [7, "", null] })).toEqual(
      empty,
    );
  });
});

describe("segmentAssignmentProblem", () => {
  it("accepts an active fixed-list segment", () => {
    expect(
      segmentAssignmentProblem({
        deletedAt: null,
        status: "active",
        type: "static",
      }),
    ).toBeNull();
  });

  it("explains why deleted, inactive and rule-based segments are skipped", () => {
    expect(segmentAssignmentProblem(undefined)).toMatch(/deleted/i);
    expect(
      segmentAssignmentProblem({
        deletedAt: "2026-11-01T00:00:00Z",
        status: "active",
        type: "static",
      }),
    ).toMatch(/deleted/i);
    expect(
      segmentAssignmentProblem({
        deletedAt: null,
        status: "archived",
        type: "static",
      }),
    ).toMatch(/not active/i);
    expect(
      segmentAssignmentProblem({
        deletedAt: null,
        status: "active",
        type: "dynamic",
      }),
    ).toMatch(/own rules/i);
  });
});
