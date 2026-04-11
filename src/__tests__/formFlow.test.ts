import { describe, expect, it } from "vitest";

import {
  filterVisibleSubmissionData,
  getEditableFormSteps,
  getAvailableConditionSourceFields,
  getNormalizedFormSteps,
} from "@/lib/forms/formFlow";
import { validateFormForPublish } from "@/lib/forms/publish";
import {
  DEFAULT_FORM_SETTINGS,
  FormField,
  FormSettings,
} from "@/types/formBuilder";

function createField(overrides: Partial<FormField>): FormField {
  return {
    id: overrides.id ?? "field",
    type: overrides.type ?? "text",
    label: overrides.label ?? "Field",
    required: overrides.required ?? false,
    mapping_key: overrides.mapping_key ?? overrides.id ?? "field",
    placeholder: overrides.placeholder,
    options: overrides.options,
    default_value: overrides.default_value,
    rules: overrides.rules,
    step_index: overrides.step_index,
    visibility_rules: overrides.visibility_rules,
  };
}

describe("formFlow helpers", () => {
  it("preserves raw step titles for active editor state", () => {
    const settings: FormSettings = {
      ...DEFAULT_FORM_SETTINGS,
      steps: [{ index: 0, title: "Step 1  ", description: "" }],
    };

    const steps = getEditableFormSteps([], settings);

    expect(steps).toEqual([
      {
        index: 0,
        title: "Step 1  ",
        description: "",
      },
    ]);
  });

  it("only exposes earlier non-hidden fields as condition sources", () => {
    const fields: FormField[] = [
      createField({ id: "email", type: "email", label: "Email" }),
      createField({ id: "secret", type: "hidden", label: "Secret" }),
      createField({ id: "updates", type: "checkbox", label: "Updates" }),
      createField({ id: "phone", type: "phone", label: "Phone" }),
    ];
    const settings: FormSettings = {
      ...DEFAULT_FORM_SETTINGS,
      steps: [{ index: 0, title: "Step 1", description: "" }],
    };
    const steps = getNormalizedFormSteps(fields, settings);

    expect(
      getAvailableConditionSourceFields(fields, "phone", steps).map(
        (field) => field.id,
      ),
    ).toEqual(["email", "updates"]);
  });

  it("keeps normalized step titles trimmed with a fallback for preview/runtime", () => {
    const settings: FormSettings = {
      ...DEFAULT_FORM_SETTINGS,
      steps: [{ index: 0, title: "   ", description: "" }],
    };

    const steps = getNormalizedFormSteps([], settings);

    expect(steps).toEqual([
      {
        index: 0,
        title: "Step 1",
        description: "",
      },
    ]);
  });

  it("drops values for fields hidden by conditional rules", () => {
    const fields: FormField[] = [
      createField({ id: "updates", type: "checkbox", label: "Updates" }),
      createField({
        id: "phone",
        type: "phone",
        label: "Phone",
        visibility_rules: [
          {
            field_id: "updates",
            operator: "equals",
            value: "true",
          },
        ],
      }),
    ];

    expect(
      filterVisibleSubmissionData(fields, {
        updates: false,
        phone: "555-123-9999",
      }),
    ).toEqual({ updates: false });

    expect(
      filterVisibleSubmissionData(fields, {
        updates: true,
        phone: "555-123-9999",
      }),
    ).toEqual({ updates: true, phone: "555-123-9999" });
  });
});

describe("validateFormForPublish", () => {
  it("flags configured steps that have no fields", () => {
    const fields: FormField[] = [
      createField({
        id: "email",
        type: "email",
        label: "Email",
        required: true,
      }),
    ];
    const settings: FormSettings = {
      ...DEFAULT_FORM_SETTINGS,
      steps: [
        { index: 0, title: "Intro", description: "" },
        { index: 1, title: "Follow-up", description: "" },
      ],
    };

    const issues = validateFormForPublish({
      name: "Newsletter Signup",
      fields,
      settings,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "empty-step",
          target: "build:steps",
        }),
      ]),
    );
  });
});
