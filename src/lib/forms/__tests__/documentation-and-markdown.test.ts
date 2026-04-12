import { describe, expect, it } from "vitest";

import {
  buildFormDocumentationModel,
  type MinimalForm,
} from "@/lib/forms/documentation";
import { buildFormMarkdownForAI } from "@/lib/forms/markdown-generator";

const baseForm: MinimalForm = {
  id: "form_123",
  tenant_id: "tenant_123",
  name: "VIP Signup",
  status: "published",
  embed_key: "embed_123",
  fields_json: [],
  settings_json: {
    form_title: "VIP Signup",
    form_description: "Join the list",
    success_message: "Thanks for signing up!",
    success_redirect_url: null,
    submit_button_text: "Join Now",
    show_branding: true,
    theme: {},
    notification_emails: [],
    steps: [{ index: 0, title: "Step 1", description: "Default step" }],
  },
  compliance_json: {
    email_consent_required: false,
    email_consent_text: "",
    sms_consent_required: false,
    sms_consent_text: "",
    double_opt_in: false,
    gdpr_compliant: false,
  },
};

describe("form documentation generators", () => {
  it("adds explicit empty-form guidance to the live docs and AI markdown exports", () => {
    const model = buildFormDocumentationModel(baseForm);
    const markdown = buildFormMarkdownForAI(baseForm);

    expect(model.isEmpty).toBe(true);
    expect(model.typescriptSchemaSnippet).toContain(
      "Add form fields in the builder to replace this placeholder.",
    );
    expect(model.markdownGuide).toContain(
      "No submit fields are configured yet.",
    );
    expect(markdown).toContain("No submit fields are configured yet.");
  });

  it("preserves select options and multi-step guidance for more complex schemas", () => {
    const form: MinimalForm = {
      ...baseForm,
      fields_json: [
        {
          id: "email-field",
          type: "email",
          label: "Email Address",
          required: true,
          mapping_key: "email",
          placeholder: "you@example.com",
          step_index: 0,
        },
        {
          id: "occasion-field",
          type: "select",
          label: "Occasion",
          required: true,
          mapping_key: "custom",
          options: ["Birthday", "Anniversary", "Just because"],
          step_index: 1,
        },
      ],
      settings_json: {
        ...baseForm.settings_json,
        steps: [
          { index: 0, title: "Contact", description: "Who is this for?" },
          { index: 1, title: "Occasion", description: "Why are they buying?" },
        ],
      },
    };

    const model = buildFormDocumentationModel(form);
    const markdown = buildFormMarkdownForAI(form);
    const occasionField = model.fieldReferences.find(
      (field) => field.fieldId === "occasion-field",
    );

    expect(model.stepCount).toBe(2);
    expect(occasionField?.options).toEqual([
      "Birthday",
      "Anniversary",
      "Just because",
    ]);
    expect(markdown).toContain(
      "Allowed options: `Birthday`, `Anniversary`, `Just because`",
    );
    expect(markdown).toContain(
      "Preserve the current multi-step grouping and field order",
    );
  });
});
