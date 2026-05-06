import type { ComponentType, SVGProps } from "react";
import { Clock, Layers, UserMinus, Sprout } from "lucide-react";

export interface ProblemCardConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

export const PROBLEM_SECTION_HEADER = {
  eyebrow: "The reality",
  headline: "Marketing for garden centres usually looks like this.",
  subtext:
    "Most garden centres are running customer marketing on tools built for someone else's business. The patches show.",
};

export const PROBLEM_CARDS: ProblemCardConfig[] = [
  {
    icon: Clock,
    title: "Marketing eats your week",
    description:
      "Social posts, email drafts, campaign planning. The list is long and lives outside the work that actually runs the store.",
  },
  {
    icon: Layers,
    title: "Tools that don't talk to each other",
    description:
      "A scheduler, an email platform, a CRM, an analytics dashboard. Each does one thing, none of them share data, and the bill adds up every month.",
  },
  {
    icon: UserMinus,
    title: "Customers slip through the cracks",
    description:
      "A walk-in browses, doesn't buy, and you never reach them again. Without an easy way to follow up, the next visit is a coin flip.",
  },
  {
    icon: Sprout,
    title: "Generic tools, generic results",
    description:
      "Most marketing software treats a garden centre like any other shop. Plant seasons, regional weather, and recurring customers don't fit the template.",
  },
];
