import { describe, expect, it } from "vitest";

import {
  buildFormDocumentationModel,
  getAliasFormDocumentationPath,
  getCanonicalFormDocumentationPath,
} from "./documentation";
import { Form } from "@/types/formBuilder";

const form: Form = {
  id: "form_123",
  tenant_id: "tenant_123",
  name: "VIP Signup",
  status: "published",
  embed_key: "0123456789abcdef0123456789abcdef",
  created_at: "2026-04-01T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
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
      id: "favorite-bloom-field",
      type: "text",
      label: "Favorite Bloom",
      required: false,
      mapping_key: "custom",
      placeholder: "Ranunculus",
      step_index: 0,
    },
    {
      id: "consent-field",
      type: "email_consent",
      label: "Email Consent",
      required: true,
      mapping_key: "email_consent",
      step_index: 0,
    },
    {
      id: "resume-field",
      type: "file",
      label: "Upload Inspiration",
      required: false,
      mapping_key: "files",
      step_index: 0,
    },
  ],
  settings_json: {
    form_title: "VIP Signup",
    form_description: "Join the list",
    success_message: "Thanks for signing up!",
    success_redirect_url: "https://example.com/thanks",
    submit_button_text: "Join Now",
    show_branding: true,
    theme: {},
    notification_emails: [],
    steps: [{ index: 0, title: "Welcome", description: "Main capture step" }],
  },
  compliance_json: {
    email_consent_required: true,
    email_consent_text: "I agree to receive email updates.",
    sms_consent_required: false,
    sms_consent_text: "",
    double_opt_in: false,
    gdpr_compliant: false,
  },
  audience_json: {
    assign_personas: [],
    assign_tags: [],
  },
};

describe("form documentation helpers", () => {
  it("builds canonical and alias routes for a form", () => {
    expect(getCanonicalFormDocumentationPath(form.id)).toBe(
      "/dashboard/forms/form_123/docs",
    );
    expect(getAliasFormDocumentationPath(form.id)).toBe(
      "/crm/forms/form_123/docs",
    );
  });

  it("generates schema-aware request examples and omits file uploads from starter payloads", () => {
    const model = buildFormDocumentationModel(form);

    expect(model.requestExample).toContain('"email": "customer@example.com"');
    expect(model.requestExample).toContain(
      '"favorite-bloom-field": "Ranunculus"',
    );
    expect(model.requestExample).toContain('"email_consent": true');
    expect(model.requestExample).not.toContain('"resume-field"');
    expect(model.requestExample).not.toContain('"embed_key"');
    expect(model.submitEndpoint).toBe(
      "http://localhost:3000/api/forms/form_123/submit",
    );

    expect(model.typescriptSchemaSnippet).toContain(
      "type BloomSuiteFileUploadReference = {",
    );
    expect(model.typescriptSchemaSnippet).toContain(
      '"favorite-bloom-field"?: string;',
    );
    expect(model.successResponseExample).toContain('"redirectUrl"');
    expect(model.curlSnippet).not.toContain("\n+");
    expect(model.markdownGuide).toContain("Primary submission endpoint");
    expect(model.markdownGuide).toContain("## Downstream Event Payload");
  });
});
