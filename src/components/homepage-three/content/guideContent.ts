import type { ComponentType, SVGProps } from "react";
import { Sprout, Calendar, MessageSquare, BarChart3 } from "lucide-react";

export interface GuideCheckmarkConfig {
  label: string;
}

export interface GuidePillarConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

export const GUIDE_SECTION_HEADER = {
  eyebrow: "Built for garden retail",
  headline: "We understand garden centres.",
  subtext:
    "BloomSuite was built around how plant retail actually works. Seasonal demand, recurring customers, regional weather, and the difference between a tomato shopper and a perennial collector.",
};

export const GUIDE_CHECKMARKS: GuideCheckmarkConfig[] = [
  { label: "Built specifically for seasonal plant businesses" },
  {
    label:
      "Understands customer buying cycles, not just last-30-days metrics",
  },
  { label: "Plant care content and seasonal templates included" },
  {
    label:
      "Used by independent garden centres, multi-location retailers, and florists",
  },
];

export const GUIDE_PILLARS: GuidePillarConfig[] = [
  {
    icon: Sprout,
    title: "Customer CRM",
    description: "Track customers, manage campaigns, automate follow-ups.",
  },
  {
    icon: Calendar,
    title: "Social and email automation",
    description:
      "Plan, schedule, and send across every channel from one workspace.",
  },
  {
    icon: MessageSquare,
    title: "SMS and email campaigns",
    description:
      "Reach customers with seasonal recommendations and timed offers.",
  },
  {
    icon: BarChart3,
    title: "Analytics and ROI",
    description:
      "Measure campaign performance and customer lifetime value.",
  },
];
