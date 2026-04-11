import { describe, expect, it } from "vitest";

import { sanitizeFormSubmissionData } from "../../supabase/functions/_shared/formVisibility.ts";

describe("sanitizeFormSubmissionData", () => {
  const fields = [
    {
      id: "email",
      type: "email",
      label: "Email",
      required: true,
      mapping_key: "email",
    },
    {
      id: "updates",
      type: "checkbox",
      label: "SMS Updates",
      required: false,
      mapping_key: "updates",
    },
    {
      id: "phone",
      type: "phone",
      label: "Phone",
      required: false,
      mapping_key: "phone_number",
      visibility_rules: [
        {
          field_id: "updates",
          operator: "equals",
          value: "true",
        },
      ],
    },
    {
      id: "utm_source",
      type: "hidden",
      label: "UTM Source",
      required: false,
      mapping_key: "utm_source",
      default_value: "spring-campaign",
    },
  ];

  it("removes inactive conditional values while preserving hidden defaults", () => {
    const result = sanitizeFormSubmissionData(fields, {
      email: "person@example.com",
      updates: false,
      phone_number: "555-111-2222",
    });

    expect(result.activeFields.map((field) => field.id)).toEqual([
      "email",
      "updates",
      "utm_source",
    ]);
    expect(result.sanitizedData).toEqual({
      email: "person@example.com",
      updates: false,
      utm_source: "spring-campaign",
    });
    expect(result.valuesByFieldId.phone).toBe("555-111-2222");
  });

  it("keeps conditional values when their rules evaluate true", () => {
    const result = sanitizeFormSubmissionData(fields, {
      email: "person@example.com",
      updates: true,
      phone_number: "555-111-2222",
    });

    expect(result.activeFields.map((field) => field.id)).toEqual([
      "email",
      "updates",
      "phone",
      "utm_source",
    ]);
    expect(result.sanitizedData).toEqual({
      email: "person@example.com",
      updates: true,
      phone_number: "555-111-2222",
      utm_source: "spring-campaign",
    });
  });
});
