import type { ComponentType, SVGProps } from "react";
import { Filter, Inbox, Users } from "lucide-react";

export interface CrmCalloutConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  delayMs: number;
}

export interface CrmTrustMetricConfig {
  value: string;
  label: string;
  showStars?: boolean;
}

export const CRM_SHOWCASE_HEADER = {
  eyebrow: "YOUR COMMAND CENTER",
  headline: "A CRM That Actually Works",
  subtext:
    "Every customer, every conversation, every sale — organized and intelligent.",
};

export const CRM_SCREENSHOT = {
  label: "CRM Dashboard Screenshot",
  annotation: "1440 × 900 px placeholder",
};

export const CRM_CALLOUTS: CrmCalloutConfig[] = [
  {
    icon: Users,
    title: "360° Customer Profiles",
    description:
      "Purchase history, preferences, lifecycle stage, and predictive insights — all in one view.",
    delayMs: 500,
  },
  {
    icon: Filter,
    title: "AI Auto-Segmentation",
    description:
      "Customers grouped by behavior, value, and engagement — automatically, no manual work.",
    delayMs: 600,
  },
  {
    icon: Inbox,
    title: "Every Channel, One Inbox",
    description:
      "Email, SMS, social messages, and reviews — all conversations in one place.",
    delayMs: 700,
  },
];

export const CRM_TRUST_METRICS: CrmTrustMetricConfig[] = [
  { value: "4.9/5", label: "Average Rating", showStars: true },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 2 min", label: "Setup Time" },
];
