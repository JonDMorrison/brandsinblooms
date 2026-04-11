import { groupFieldsByStep, isMultiStepEnabled } from "@/lib/forms/formFlow";
import { FormField, FormSettings } from "@/types/formBuilder";

export type PublishValidationTarget =
  | "header:name"
  | "build:fields"
  | "build:email-field"
  | "build:sms-phone-pair"
  | "build:steps";

export interface PublishValidationIssue {
  id:
    | "missing-name"
    | "missing-fields"
    | "missing-email-field"
    | "sms-consent-missing-phone"
    | "empty-step";
  description: string;
  fixHint: string;
  target: PublishValidationTarget;
  targetTab: "header" | "build";
}

interface ValidateFormForPublishInput {
  name: string;
  fields: FormField[];
  settings: FormSettings;
}

export function validateFormForPublish({
  name,
  fields,
  settings,
}: ValidateFormForPublishInput): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];

  if (!name.trim()) {
    issues.push({
      id: "missing-name",
      description: "Form name is required before you can publish.",
      fixHint: "Add a clear form name in the editor header.",
      target: "header:name",
      targetTab: "header",
    });
  }

  if (fields.length === 0) {
    issues.push({
      id: "missing-fields",
      description: "Add at least one field before publishing.",
      fixHint: "Open the Build tab and add the first field to this form.",
      target: "build:fields",
      targetTab: "build",
    });
  }

  if (!fields.some((field) => field.type === "email")) {
    issues.push({
      id: "missing-email-field",
      description:
        "An email field is required so submissions can identify the customer.",
      fixHint: "Open the Build tab and add an Email Address field.",
      target: "build:email-field",
      targetTab: "build",
    });
  }

  const hasSmsConsent = fields.some((field) => field.type === "sms_consent");
  const hasPhoneField = fields.some((field) => field.type === "phone");

  if (hasSmsConsent && !hasPhoneField) {
    issues.push({
      id: "sms-consent-missing-phone",
      description:
        "SMS consent cannot be published without a phone field in the form.",
      fixHint:
        "Open the Build tab and add a phone field or remove SMS consent.",
      target: "build:sms-phone-pair",
      targetTab: "build",
    });
  }

  if (isMultiStepEnabled(settings)) {
    const stepGroups = groupFieldsByStep(fields, settings.steps || []);
    const emptyStep = stepGroups.find(
      (stepGroup) => stepGroup.fields.length === 0,
    );

    if (emptyStep) {
      issues.push({
        id: "empty-step",
        description: `${emptyStep.step.title} needs at least one field before the form can be published.`,
        fixHint:
          "Add a field to the empty step or remove that step from the Build tab.",
        target: "build:steps",
        targetTab: "build",
      });
    }
  }

  return issues;
}
