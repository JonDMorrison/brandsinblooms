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
  eyebrow: "Your CRM",
  headline: "A CRM shaped like a garden centre.",
  subtext:
    "Built around how plant retail actually works. Seasonal customers, big spring buyers, repeat florist orders, and walk-ins who become regulars.",
};

export const CRM_SCREENSHOT = {
  label: "CRM Dashboard Screenshot",
  annotation: "1440 × 900 px placeholder",
};

export const CRM_CALLOUTS: CrmCalloutConfig[] = [
  {
    icon: Users,
    title: "360 customer view",
    description:
      "Every purchase, every email open, every message in one profile. Pulled from your POS, not retyped.",
    delayMs: 500,
  },
  {
    icon: Filter,
    title: "Smart segmentation",
    description:
      "Spring buyers, dormant customers, big spenders. Segments update as customers behave differently.",
    delayMs: 600,
  },
  {
    icon: Inbox,
    title: "Unified inbox",
    description:
      "Email, SMS, social messages, and reviews in one place. Reply once, log everywhere.",
    delayMs: 700,
  },
];

// Stats strip (4.9/5, 99.9%, < 2 min) hidden until verified.
// Keeping the export with an empty array so existing consumers compile.
export const CRM_TRUST_METRICS: CrmTrustMetricConfig[] = [];
