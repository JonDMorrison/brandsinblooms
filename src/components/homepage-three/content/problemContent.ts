import type { ComponentType, SVGProps } from "react";
import { KeyRound, Unplug, ClipboardList, Zap } from "lucide-react";

export interface ProblemCardConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

export const PROBLEM_SECTION_HEADER = {
  eyebrow: "Sound familiar?",
  headline: "Marketing feels harder than it should.",
  subtext:
    "Most garden centres are running customer marketing across a stack of disconnected tools that weren't built with them in mind. Time, data, and customers all leak out.",
};

export const PROBLEM_CARDS: ProblemCardConfig[] = [
  {
    icon: KeyRound,
    title: "Too many logins, too many tabs",
    description:
      "A scheduler in one tab, email in another, a CRM somewhere else, analytics in a fourth. You spend more time finding the right login than doing the actual work.",
  },
  {
    icon: Unplug,
    title: "Tools that don't talk to each other",
    description:
      "Customer info lives in one system, sales in another, campaigns in a third. The data never connects, so customers get mixed messages and you never see the full picture.",
  },
  {
    icon: ClipboardList,
    title: "No real system, just instinct",
    description:
      "When the busy season hits, you're running on memory and sticky notes. The work is real, but the playbook lives in your head and that doesn't scale.",
  },
  {
    icon: Zap,
    title: "Modern tools, missing for garden centres",
    description:
      "AI, automation, smart segmentation. The tools that move other businesses forward weren't built with garden centres in mind. Most owners are stuck on yesterday's stack.",
  },
];
