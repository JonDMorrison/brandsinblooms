import * as React from "react";
import type { ColorPaletteProp } from "@mui/joy/styles";
import type { LucideIcon } from "lucide-react";
import {
  Cake,
  Clock3,
  CreditCard,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  Timer,
  UserCheck,
  UsersRound,
  Webhook,
  Zap,
} from "lucide-react";
import { getTriggerById } from "@/lib/automation/triggerCatalog";

export type AutomationNodeCategory =
  | "trigger"
  | "communication"
  | "delay"
  | "logic";

export type AutomationNodeTone = {
  color: ColorPaletteProp;
  accentColor: string;
  borderColor: string;
  hoverBorderColor: string;
  backgroundColor: string;
  ringColor: string;
};

export type AutomationPaletteItem = {
  label: string;
  nodeType: string;
  triggerType?: string;
  icon: LucideIcon;
  category: AutomationNodeCategory;
};

export type AutomationNodeVisual = {
  badge: string;
  title: string;
  description: string;
  summary: string | null;
  icon: React.ReactNode;
  tone: AutomationNodeTone;
  category: AutomationNodeCategory;
};

const categoryTones: Record<AutomationNodeCategory, AutomationNodeTone> = {
  trigger: {
    color: "primary",
    accentColor: "var(--joy-palette-primary-500)",
    borderColor: "var(--joy-palette-primary-200)",
    hoverBorderColor: "var(--joy-palette-primary-300)",
    backgroundColor: "var(--joy-palette-primary-50)",
    ringColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.16)",
  },
  communication: {
    color: "info",
    accentColor: "var(--joy-palette-info-500)",
    borderColor: "var(--joy-palette-info-200)",
    hoverBorderColor: "var(--joy-palette-info-300)",
    backgroundColor: "var(--joy-palette-info-50)",
    ringColor: "rgba(var(--joy-palette-info-mainChannel) / 0.16)",
  },
  delay: {
    color: "warning",
    accentColor: "var(--joy-palette-warning-500)",
    borderColor: "var(--joy-palette-warning-200)",
    hoverBorderColor: "var(--joy-palette-warning-300)",
    backgroundColor: "var(--joy-palette-warning-50)",
    ringColor: "rgba(var(--joy-palette-warning-mainChannel) / 0.18)",
  },
  logic: {
    color: "neutral",
    accentColor: "var(--joy-palette-neutral-500)",
    borderColor: "var(--joy-palette-neutral-200)",
    hoverBorderColor: "var(--joy-palette-neutral-300)",
    backgroundColor: "var(--joy-palette-neutral-50)",
    ringColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.14)",
  },
};

const triggerIconMap: Record<string, LucideIcon> = {
  "segment.added": UsersRound,
  "persona.assigned": UserCheck,
  form_submitted: FileText,
  "payment.completed": CreditCard,
  birthday: Cake,
  new_product_drop: Clock3,
  custom_webhook: Webhook,
};

const templates = [
  {
    value: "welcome",
    label: "Welcome",
    subject: "Welcome to Brands in Blooms, {{first_name}}",
    content:
      "We are glad you are here. Here are three quick ways to get more from your next visit...",
  },
  {
    value: "promotion",
    label: "Promotion",
    subject: "A fresh offer for your next visit",
    content:
      "This week we picked a few customer favorites and bundled them into an easy seasonal offer...",
  },
  {
    value: "followup",
    label: "Follow-up",
    subject: "How did everything go?",
    content:
      "Thanks again for shopping with us. If you need help with care, setup, or your next pick, reply to this email...",
  },
];

export const emailTemplateOptions = templates.map((template) => ({
  value: template.value,
  label: template.label,
  subject: template.subject,
  content: template.content,
}));

export const emailDelayOptions = [
  { value: "Immediate", label: "Immediate" },
  { value: "30 minutes", label: "30 minutes" },
  { value: "2 hours", label: "2 hours" },
  { value: "1 day", label: "1 day" },
  { value: "3 days", label: "3 days" },
];

export const splitFieldOptions = [
  { value: "total_spent", label: "Total spent" },
  { value: "last_purchase_date", label: "Last purchase date" },
  { value: "loyalty_status", label: "Loyalty status" },
  { value: "tag", label: "Customer tag" },
];

export const splitOperatorOptions = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
];

export const delayUnitOptions = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
];

export const automationPaletteSections: Array<{
  label: string;
  items: AutomationPaletteItem[];
}> = [
  {
    label: "Triggers",
    items: [
      {
        label: "Segment joined",
        nodeType: "trigger",
        triggerType: "segment.added",
        icon: UsersRound,
        category: "trigger",
      },
      {
        label: "Persona assigned",
        nodeType: "trigger",
        triggerType: "persona.assigned",
        icon: UserCheck,
        category: "trigger",
      },
      {
        label: "Form submitted",
        nodeType: "trigger",
        triggerType: "form_submitted",
        icon: FileText,
        category: "trigger",
      },
      {
        label: "Payment received",
        nodeType: "trigger",
        triggerType: "payment.completed",
        icon: CreditCard,
        category: "trigger",
      },
      {
        label: "Customer birthday",
        nodeType: "trigger",
        triggerType: "birthday",
        icon: Cake,
        category: "trigger",
      },
      {
        label: "Scheduled time",
        nodeType: "trigger",
        triggerType: "new_product_drop",
        icon: Clock3,
        category: "trigger",
      },
      {
        label: "Webhook received",
        nodeType: "trigger",
        triggerType: "custom_webhook",
        icon: Webhook,
        category: "trigger",
      },
    ],
  },
  {
    label: "Actions",
    items: [
      {
        label: "Send email",
        nodeType: "email",
        icon: Mail,
        category: "communication",
      },
      {
        label: "Send SMS",
        nodeType: "sms",
        icon: MessageSquare,
        category: "communication",
      },
      {
        label: "Wait / Delay",
        nodeType: "delay",
        icon: Timer,
        category: "delay",
      },
    ],
  },
  {
    label: "Logic",
    items: [
      {
        label: "Condition",
        nodeType: "split",
        icon: GitBranch,
        category: "logic",
      },
    ],
  },
];

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value: string, length = 88) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 1).trimEnd()}…`;
}

function stripLeadingGlyphs(value: string) {
  return value.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function singularize(unit: string) {
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

function formatDelayTitle(delayValue: number, delayUnit: string) {
  if (delayValue === 1) {
    return `Wait 1 ${singularize(delayUnit)}`;
  }

  return `Wait ${delayValue} ${delayUnit}`;
}

function getToneForNodeType(nodeType: string): AutomationNodeTone {
  switch (nodeType) {
    case "trigger":
      return categoryTones.trigger;
    case "email":
    case "sms":
      return categoryTones.communication;
    case "delay":
      return categoryTones.delay;
    case "split":
    default:
      return categoryTones.logic;
  }
}

function getCategoryForNodeType(nodeType: string): AutomationNodeCategory {
  switch (nodeType) {
    case "trigger":
      return "trigger";
    case "email":
    case "sms":
      return "communication";
    case "delay":
      return "delay";
    case "split":
    default:
      return "logic";
  }
}

function getBadgeForNodeType(nodeType: string) {
  switch (nodeType) {
    case "trigger":
      return "TRIGGER";
    case "email":
      return "EMAIL";
    case "sms":
      return "SMS";
    case "delay":
      return "DELAY";
    case "split":
    default:
      return "CONDITION";
  }
}

function getNodeIcon(nodeType: string, triggerType?: string) {
  if (nodeType === "trigger") {
    const TriggerIcon =
      (triggerType ? triggerIconMap[triggerType] : undefined) ?? Zap;
    return <TriggerIcon size={18} />;
  }

  switch (nodeType) {
    case "email":
      return <Mail size={18} />;
    case "sms":
      return <MessageSquare size={18} />;
    case "delay":
      return <Timer size={18} />;
    case "split":
    default:
      return <GitBranch size={18} />;
  }
}

function getTriggerSummary(data: Record<string, unknown>, triggerType: string) {
  const conditions =
    typeof data.conditions === "object" && data.conditions
      ? (data.conditions as Record<string, unknown>)
      : {};
  const segmentName = stringValue(conditions.segment_name);
  const personaName = stringValue(conditions.persona_name);
  const formName = stringValue(conditions.form_name);

  if (segmentName) {
    return `Segment: ${segmentName}`;
  }

  if (personaName) {
    return `Persona: ${personaName}`;
  }

  if (formName) {
    return `Form: ${formName}`;
  }

  return `Event: ${triggerType}`;
}

export function getAutomationNodeVisual(
  nodeType: string,
  data: Record<string, unknown> = {},
  paletteTriggerType?: string,
): AutomationNodeVisual {
  const category = getCategoryForNodeType(nodeType);
  const triggerType =
    paletteTriggerType || stringValue(data.triggerType) || "loyalty_join";
  const triggerMeta = getTriggerById(triggerType);
  const title =
    nodeType === "trigger"
      ? stringValue(data.label) ||
        stripLeadingGlyphs(triggerMeta?.label || "Trigger")
      : nodeType === "email"
        ? stringValue(data.title) ||
          stringValue(data.subject) ||
          "Email message"
        : nodeType === "sms"
          ? stringValue(data.title) ||
            truncate(
              stringValue(data.message) ||
                stringValue(data.content) ||
                "SMS message",
              40,
            )
          : nodeType === "delay"
            ? stringValue(data.title) ||
              formatDelayTitle(
                Number(data.delayValue) || 1,
                stringValue(data.delayUnit) || "hours",
              )
            : stringValue(data.title) || "Condition";
  const description =
    nodeType === "trigger"
      ? truncate(
          stringValue(data.description) ||
            triggerMeta?.description ||
            `Fires on ${triggerType}`,
        )
      : nodeType === "email"
        ? truncate(
            stringValue(data.content) ||
              stringValue(data.body) ||
              "Compose the message content for this step.",
          )
        : nodeType === "sms"
          ? truncate(
              stringValue(data.message) ||
                stringValue(data.content) ||
                "Write the SMS copy for this step.",
            )
          : nodeType === "delay"
            ? truncate(
                stringValue(data.description) ||
                  "Pause the automation before the next step runs.",
              )
            : truncate(
                stringValue(data.description) ||
                  "Route contacts down the appropriate path based on the configured rule.",
              );
  const summary =
    nodeType === "trigger"
      ? getTriggerSummary(data, triggerType)
      : nodeType === "email"
        ? stringValue(data.template)
          ? `Template: ${stringValue(data.template)}`
          : stringValue(data.delay)
            ? `Send: ${stringValue(data.delay)}`
            : null
        : nodeType === "sms"
          ? `${
              stringValue(data.characterCount) ||
              String(
                (stringValue(data.message) || stringValue(data.content)).length,
              )
            }/160 chars`
          : nodeType === "delay"
            ? `${Number(data.delayValue) || 1} ${
                stringValue(data.delayUnit) || "hours"
              }`
            : stringValue(data.conditionField) &&
                stringValue(data.conditionOperator) &&
                stringValue(data.conditionValue)
              ? `${stringValue(data.conditionField)} ${stringValue(
                  data.conditionOperator,
                )} ${stringValue(data.conditionValue)}`
              : null;

  return {
    badge: getBadgeForNodeType(nodeType),
    title,
    description,
    summary,
    icon: getNodeIcon(nodeType, triggerType),
    tone: getToneForNodeType(nodeType),
    category,
  };
}
