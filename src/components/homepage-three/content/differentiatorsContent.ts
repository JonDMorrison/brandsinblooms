import type { ComponentType, SVGProps } from "react";
import { MessageCircle, GraduationCap, Users } from "lucide-react";

export interface DifferentiatorCardConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

export const DIFFERENTIATORS_SECTION_HEADER = {
  eyebrow: "More than software",
  headline: "A partner for your garden centre.",
  subtext:
    "BloomSuite isn't just a platform. You also get the people, the training, and the community that come with it.",
};

export const DIFFERENTIATOR_CARDS: DifferentiatorCardConfig[] = [
  {
    icon: MessageCircle,
    title: "Real human support",
    description:
      "Talk to people who know horticulture and care about your store. No bots, no script trees, no waiting on hold for an hour.",
  },
  {
    icon: GraduationCap,
    title: "Training included",
    description:
      "Step-by-step tutorials, workshops, and strategy courses. Learn how to use BloomSuite and how to run modern marketing for a garden centre.",
  },
  {
    icon: Users,
    title: "Garden centre community",
    description:
      "Join a private network of garden centre owners and managers. Share what's working, swap seasonal ideas, and get answers from people who've been there.",
  },
];
