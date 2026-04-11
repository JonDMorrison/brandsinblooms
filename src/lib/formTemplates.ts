import { normalizeFormSettings } from "@/lib/forms/designSettings";
import {
  DEFAULT_FORM_SETTINGS,
  FormCompliance,
  FormTemplate,
  FormField,
  FormSettings,
} from "@/types/formBuilder";

// Generate UUIDs for templates
const generateId = (): string => crypto.randomUUID();

const STARTER_FORM_FIELDS: Omit<FormField, "id">[] = [
  {
    type: "email",
    label: "Email Address",
    required: true,
    placeholder: "you@example.com",
    mapping_key: "email",
  },
];

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "newsletter-signup",
    name: "Newsletter Signup",
    description: "Simple email signup with optional first name",
    category: "Lead Generation",
    fields: [
      {
        id: generateId(),
        type: "email",
        label: "Email Address",
        required: true,
        placeholder: "you@example.com",
        mapping_key: "email",
      },
      {
        id: generateId(),
        type: "text",
        label: "First Name",
        required: false,
        placeholder: "Your first name",
        mapping_key: "first_name",
      },
      {
        id: generateId(),
        type: "email_consent",
        label: "Email Consent",
        required: true,
        mapping_key: "email_consent",
      },
    ],
    settings: {
      success_message: "Thanks for subscribing! Check your inbox for updates.",
      submit_button_text: "Subscribe",
    },
    compliance: {
      email_consent_required: true,
      email_consent_text: "I agree to receive marketing emails and updates.",
    },
  },
  {
    id: "vip-waitlist",
    name: "VIP Waitlist",
    description: "Collect email and phone for exclusive access",
    category: "Lead Generation",
    fields: [
      {
        id: generateId(),
        type: "email",
        label: "Email Address",
        required: true,
        placeholder: "you@example.com",
        mapping_key: "email",
      },
      {
        id: generateId(),
        type: "phone",
        label: "Phone Number",
        required: true,
        placeholder: "(555) 123-4567",
        mapping_key: "phone",
      },
      {
        id: generateId(),
        type: "email_consent",
        label: "Email Consent",
        required: true,
        mapping_key: "email_consent",
      },
      {
        id: generateId(),
        type: "sms_consent",
        label: "SMS Consent",
        required: true,
        mapping_key: "sms_consent",
      },
    ],
    settings: {
      success_message:
        "You're on the list! We'll be in touch soon with exclusive access.",
      submit_button_text: "Join Waitlist",
    },
    compliance: {
      email_consent_required: true,
      email_consent_text: "I agree to receive marketing emails.",
      sms_consent_required: true,
      sms_consent_text:
        "I agree to receive SMS messages. Msg & data rates may apply.",
    },
  },
  {
    id: "event-signup",
    name: "Event Signup",
    description: "Registration form with event selection",
    category: "Events",
    fields: [
      {
        id: generateId(),
        type: "email",
        label: "Email Address",
        required: true,
        placeholder: "you@example.com",
        mapping_key: "email",
      },
      {
        id: generateId(),
        type: "text",
        label: "Full Name",
        required: true,
        placeholder: "Your full name",
        mapping_key: "first_name",
      },
      {
        id: generateId(),
        type: "select",
        label: "Event Time",
        required: true,
        options: [
          "Morning Session (9am)",
          "Afternoon Session (2pm)",
          "Evening Session (6pm)",
        ],
        mapping_key: "custom",
      },
      {
        id: generateId(),
        type: "email_consent",
        label: "Email Consent",
        required: true,
        mapping_key: "email_consent",
      },
    ],
    settings: {
      success_message: "You're registered! Check your email for event details.",
      submit_button_text: "Register",
    },
    compliance: {
      email_consent_required: true,
      email_consent_text:
        "I agree to receive event updates and marketing emails.",
    },
  },
];

export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}

export function createStarterForm(): {
  fields_json: FormField[];
} {
  return {
    fields_json: STARTER_FORM_FIELDS.map((field) => ({
      ...field,
      id: generateId(),
    })),
  };
}

function getFieldPreviewLabel(field: FormField): string {
  switch (field.type) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "file":
      return "File Upload";
    case "email_consent":
      return "Consent";
    case "sms_consent":
      return "SMS Consent";
    default:
      return field.label;
  }
}

export function getTemplateFieldPreview(
  template: FormTemplate,
  limit: number = 5,
): string {
  const labels = template.fields.slice(0, limit).map(getFieldPreviewLabel);
  const suffix = template.fields.length > limit ? ", ..." : "";

  return `${template.fields.length} fields: ${labels.join(", ")}${suffix}`;
}

export function createFormFromTemplate(template: FormTemplate): {
  fields_json: FormField[];
  settings_json: FormSettings;
  compliance_json: FormCompliance;
} {
  // Generate fresh IDs for fields
  const fields = template.fields.map((field) => ({
    ...field,
    id: crypto.randomUUID(),
  }));

  return {
    fields_json: fields,
    settings_json: normalizeFormSettings({
      ...DEFAULT_FORM_SETTINGS,
      ...template.settings,
    }),
    compliance_json: {
      email_consent_required:
        template.compliance.email_consent_required || false,
      email_consent_text:
        template.compliance.email_consent_text ||
        "I agree to receive marketing emails",
      sms_consent_required: template.compliance.sms_consent_required || false,
      sms_consent_text:
        template.compliance.sms_consent_text ||
        "I agree to receive SMS messages",
      double_opt_in: false,
      gdpr_compliant: false,
    },
  };
}
