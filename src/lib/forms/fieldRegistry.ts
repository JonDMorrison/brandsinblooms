import {
  CheckSquare,
  EyeOff,
  FileUp,
  List,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FormCompliance, FormField, FormFieldType } from "@/types/formBuilder";

type FieldCategory = "basic" | "compliance";

export interface FieldTypeDefinition {
  type: FormFieldType;
  category: FieldCategory;
  label: string;
  description: string;
  helperText: string;
  icon: LucideIcon;
  defaultLabel: string;
  defaultRequired: boolean;
  defaultMappingKey: string;
  defaultPlaceholder?: string;
  defaultOptions?: string[];
  singleInstance?: boolean;
}

const FIELD_TYPE_DEFINITIONS: FieldTypeDefinition[] = [
  {
    type: "text",
    category: "basic",
    label: "Text Input",
    description:
      "Single line text input for names, addresses, and short answers.",
    helperText:
      "Use for names, company names, short notes, and other simple text values.",
    icon: Type,
    defaultLabel: "Text Field",
    defaultRequired: false,
    defaultMappingKey: "custom",
    defaultPlaceholder: "Enter your answer...",
  },
  {
    type: "email",
    category: "basic",
    label: "Email Address",
    description: "Email capture field with built-in email validation.",
    helperText:
      "Email is used for customer identification and always keeps email-format validation.",
    icon: Mail,
    defaultLabel: "Email Address",
    defaultRequired: true,
    defaultMappingKey: "email",
    defaultPlaceholder: "you@example.com",
  },
  {
    type: "phone",
    category: "basic",
    label: "Phone Number",
    description: "Phone input for mobile or landline numbers.",
    helperText:
      "Use when you need SMS consent or want to capture a contact number.",
    icon: Phone,
    defaultLabel: "Phone Number",
    defaultRequired: false,
    defaultMappingKey: "phone",
    defaultPlaceholder: "(555) 123-4567",
  },
  {
    type: "select",
    category: "basic",
    label: "Dropdown Select",
    description: "Let visitors choose one option from a short list.",
    helperText:
      "Best for small predefined lists where only one option can be selected.",
    icon: List,
    defaultLabel: "Choose an Option",
    defaultRequired: false,
    defaultMappingKey: "custom",
    defaultPlaceholder: "Select an option",
    defaultOptions: ["Option 1"],
  },
  {
    type: "checkbox",
    category: "basic",
    label: "Checkbox",
    description:
      "Optional yes/no field. Use to let visitors opt into a segment or persona when they check the box.",
    helperText:
      "Optionally assign the customer to a segment or persona when they check this box.",
    icon: CheckSquare,
    defaultLabel: "Checkbox",
    defaultRequired: false,
    defaultMappingKey: "custom",
  },
  {
    type: "file",
    category: "basic",
    label: "File Upload",
    description:
      "Collect one or more files with client-side size and type checks.",
    helperText:
      "Uploads stay private and are finalized only when the visitor submits the form.",
    icon: FileUp,
    defaultLabel: "Upload Files",
    defaultRequired: false,
    defaultMappingKey: "files",
  },
  {
    type: "hidden",
    category: "basic",
    label: "Hidden Field",
    description:
      "Store invisible values like campaign tags or tracking metadata.",
    helperText:
      "Hidden values are submitted with the form without being shown to visitors.",
    icon: EyeOff,
    defaultLabel: "Hidden Field",
    defaultRequired: false,
    defaultMappingKey: "custom",
  },
  {
    type: "email_consent",
    category: "compliance",
    label: "Email Consent",
    description: "Collect explicit permission for email marketing messages.",
    helperText:
      "Keep consent copy clear and specific so customers understand what they are opting into.",
    icon: ShieldCheck,
    defaultLabel: "Email Consent",
    defaultRequired: true,
    defaultMappingKey: "email_consent",
    singleInstance: true,
  },
  {
    type: "sms_consent",
    category: "compliance",
    label: "SMS Consent",
    description: "Collect explicit permission for text message marketing.",
    helperText:
      "SMS consent should be paired with a phone field and clear TCPA-compliant disclosure text.",
    icon: MessageSquare,
    defaultLabel: "SMS Consent",
    defaultRequired: true,
    defaultMappingKey: "sms_consent",
    singleInstance: true,
  },
  {
    type: "segment_checkbox",
    category: "basic",
    label: "Segment Opt-In",
    description: "Let visitors join one or more CRM segments by checking options.",
    helperText:
      "Add one option per CRM segment you want to offer. Each option pairs a real segment with the public label the visitor sees. On submit, the contact joins every segment they chose.",
    icon: Users,
    defaultLabel: "Tell us what you're interested in",
    defaultRequired: false,
    defaultMappingKey: "segment_opt_in",
  },
];

export const FIELD_DEFINITION_MAP = FIELD_TYPE_DEFINITIONS.reduce(
  (definitions, definition) => {
    definitions[definition.type] = definition;
    return definitions;
  },
  {} as Record<FormFieldType, FieldTypeDefinition>,
);

export const BASIC_FIELD_DEFINITIONS = FIELD_TYPE_DEFINITIONS.filter(
  (definition) => definition.category === "basic",
);

export const COMPLIANCE_FIELD_DEFINITIONS = FIELD_TYPE_DEFINITIONS.filter(
  (definition) => definition.category === "compliance",
);

export function getFieldDefinition(type: FormFieldType): FieldTypeDefinition {
  return FIELD_DEFINITION_MAP[type];
}

export function isConsentFieldType(type: FormFieldType): boolean {
  return type === "email_consent" || type === "sms_consent";
}

export function canAddFieldType(
  type: FormFieldType,
  fields: FormField[],
): boolean {
  if (!isConsentFieldType(type)) {
    return true;
  }

  return !fields.some((field) => field.type === type);
}

export function getConsentText(
  type: Extract<FormFieldType, "email_consent" | "sms_consent">,
  compliance: FormCompliance,
): string {
  return type === "email_consent"
    ? compliance.email_consent_text
    : compliance.sms_consent_text;
}

export function createFieldFromType(
  type: FormFieldType,
  compliance: FormCompliance,
): FormField {
  const definition = getFieldDefinition(type);
  const fieldId = crypto.randomUUID();

  return {
    id: fieldId,
    type,
    label: definition.defaultLabel,
    required:
      type === "email_consent"
        ? compliance.email_consent_required || definition.defaultRequired
        : type === "sms_consent"
          ? compliance.sms_consent_required || definition.defaultRequired
          : definition.defaultRequired,
    placeholder: definition.defaultPlaceholder,
    options: definition.defaultOptions
      ? [...definition.defaultOptions]
      : undefined,
    mapping_key:
      type === "file"
        ? `file_${fieldId.slice(0, 8)}`
        : type === "segment_checkbox"
          ? `segment_checkbox_${fieldId.slice(0, 8)}`
          : definition.defaultMappingKey,
    default_value:
      type === "checkbox" ? false : type === "file" ? undefined : "",
    rules:
      type === "file"
        ? {
            max_files: 1,
            max_file_size_mb: 10,
            allowed_mime_types: [],
          }
        : undefined,
  };
}
