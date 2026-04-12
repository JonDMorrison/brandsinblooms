import { describe, expect, it } from "vitest";

import type { Form } from "@/types/formBuilder";

import { buildFormMarkdownForAI } from "./markdown-generator";

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
      rules: {
        min_length: 3,
      },
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
    email_consent_required: false,
    email_consent_text: "",
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

describe("buildFormMarkdownForAI", () => {
  it("builds a proxy-first AI markdown export with schema and snippets", () => {
    const markdown = buildFormMarkdownForAI(form);

    expect(markdown).toContain("Integration Spec for AI Coding Agents");
    expect(markdown).toContain("For AI Training & Integration Purposes");
    expect(markdown).toContain(
      "http://localhost:3000/api/forms/form_123/submit",
    );
    expect(markdown).toContain(
      "Do not send `embed_key` in the primary request body",
    );
    expect(markdown).toContain("export const submissionSchema = z.object");
    expect(markdown).toContain("Compatibility Wrapper Example");
    expect(markdown).toContain("Favorite Bloom");
  });
});
