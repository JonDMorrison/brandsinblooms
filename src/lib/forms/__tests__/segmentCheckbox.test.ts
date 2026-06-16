import { describe, expect, it } from "vitest";

import type { FormField } from "@/types/formBuilder";
import {
  getEmptySegmentValue,
  getSegmentOptions,
  getSubmittedSegmentIds,
  hasSegmentOptions,
} from "@/lib/forms/segmentCheckbox";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function buildField(overrides: Partial<FormField>): FormField {
  return {
    id: "field-1",
    type: "segment_checkbox",
    label: "Tell us what you're into",
    required: false,
    mapping_key: "interests",
    ...overrides,
  };
}

describe("getSegmentOptions", () => {
  it("returns the explicit options when present", () => {
    const field = buildField({
      segment_options: [
        { segment_id: UUID_A, label: "Newsletter" },
        { segment_id: UUID_B, label: "Workshops" },
      ],
    });

    expect(getSegmentOptions(field)).toEqual([
      { segment_id: UUID_A, label: "Newsletter" },
      { segment_id: UUID_B, label: "Workshops" },
    ]);
  });

  it("falls back to the field label when a label is blank", () => {
    const field = buildField({
      label: "Sign me up",
      segment_options: [{ segment_id: UUID_A, label: "" }],
    });

    expect(getSegmentOptions(field)).toEqual([
      { segment_id: UUID_A, label: "Sign me up" },
    ]);
  });

  it("migrates a legacy single-segment binding into a one-option list", () => {
    const field = buildField({
      label: "Newsletter",
      segment_id: UUID_A,
      segment_name: "VIP launch list",
    });

    expect(getSegmentOptions(field)).toEqual([
      { segment_id: UUID_A, label: "VIP launch list" },
    ]);
  });

  it("uses the field label when the legacy segment_name is missing", () => {
    const field = buildField({
      label: "Newsletter",
      segment_id: UUID_A,
    });

    expect(getSegmentOptions(field)).toEqual([
      { segment_id: UUID_A, label: "Newsletter" },
    ]);
  });

  it("returns [] for a field with neither shape configured", () => {
    expect(getSegmentOptions(buildField({}))).toEqual([]);
  });

  it("drops malformed options without ids", () => {
    const field = buildField({
      // @ts-expect-error — exercising the runtime guard
      segment_options: [
        { segment_id: "", label: "Empty id" },
        { segment_id: UUID_A, label: "Valid" },
        null,
      ],
    });

    expect(getSegmentOptions(field)).toEqual([
      { segment_id: UUID_A, label: "Valid" },
    ]);
  });
});

describe("hasSegmentOptions", () => {
  it("is true for both modern and legacy fields", () => {
    expect(
      hasSegmentOptions(
        buildField({
          segment_options: [{ segment_id: UUID_A, label: "A" }],
        }),
      ),
    ).toBe(true);
    expect(hasSegmentOptions(buildField({ segment_id: UUID_A }))).toBe(true);
  });

  it("is false for an unconfigured field", () => {
    expect(hasSegmentOptions(buildField({}))).toBe(false);
  });
});

describe("getSubmittedSegmentIds", () => {
  const multiField = buildField({
    segment_options: [
      { segment_id: UUID_A, label: "Newsletter" },
      { segment_id: UUID_B, label: "Workshops" },
      { segment_id: UUID_C, label: "VIP" },
    ],
  });

  it("returns the checked ids for a multi-checkbox submission", () => {
    expect(getSubmittedSegmentIds(multiField, [UUID_A, UUID_C])).toEqual([
      UUID_A,
      UUID_C,
    ]);
  });

  it("returns a single id for a single-select submission", () => {
    expect(getSubmittedSegmentIds(multiField, UUID_B)).toEqual([UUID_B]);
  });

  it("ignores ids that aren't among the field's configured options", () => {
    const stranger = "44444444-4444-4444-8444-444444444444";
    expect(
      getSubmittedSegmentIds(multiField, [UUID_A, stranger, UUID_B]),
    ).toEqual([UUID_A, UUID_B]);
  });

  it("ignores non-UUID strings entirely (no name-based matching)", () => {
    expect(
      getSubmittedSegmentIds(multiField, ["Newsletter", "Workshops"]),
    ).toEqual([]);
  });

  it("deduplicates repeated ids while preserving order", () => {
    expect(
      getSubmittedSegmentIds(multiField, [UUID_B, UUID_A, UUID_B]),
    ).toEqual([UUID_B, UUID_A]);
  });

  it("returns [] for an empty / false / null / undefined submission", () => {
    for (const value of [[], false, null, undefined, "", 0]) {
      expect(getSubmittedSegmentIds(multiField, value)).toEqual([]);
    }
  });

  it("supports legacy `true` value on a one-option field (back-compat)", () => {
    const legacy = buildField({
      segment_options: [{ segment_id: UUID_A, label: "Newsletter" }],
    });
    expect(getSubmittedSegmentIds(legacy, true)).toEqual([UUID_A]);
  });

  it("supports legacy single-segment field with a boolean true value", () => {
    const legacy = buildField({
      segment_id: UUID_A,
      segment_name: "Newsletter",
    });
    expect(getSubmittedSegmentIds(legacy, true)).toEqual([UUID_A]);
  });

  it("returns [] for a legacy single-segment field when unchecked", () => {
    const legacy = buildField({
      segment_id: UUID_A,
    });
    expect(getSubmittedSegmentIds(legacy, false)).toEqual([]);
  });
});

describe("getEmptySegmentValue", () => {
  it("seeds an empty array for multi-option fields", () => {
    const field = buildField({
      segment_options: [{ segment_id: UUID_A, label: "A" }],
    });
    expect(getEmptySegmentValue(field)).toEqual([]);
  });

  it("seeds `false` for legacy single-segment fields (back-compat)", () => {
    expect(getEmptySegmentValue(buildField({ segment_id: UUID_A }))).toBe(
      false,
    );
  });
});
