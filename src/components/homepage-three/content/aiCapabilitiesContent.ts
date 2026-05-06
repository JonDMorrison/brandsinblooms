import type { ComponentType, SVGProps } from "react";
import { Calendar, PenTool, TrendingUp, Zap } from "lucide-react";

export interface AiCapabilityCardConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  delayMs: number;
}

export type AiChatSpeaker = "user" | "ai";

export interface AiChatLineConfig {
  text: string;
  kind?: "text" | "customer" | "question" | "success";
}

export interface AiChatTurnConfig {
  id: string;
  speaker: AiChatSpeaker;
  text?: string;
  lines?: AiChatLineConfig[];
  typingDelayMs?: number;
  afterCompleteDelayMs?: number;
}

export const AI_CAPABILITIES_HEADER = {
  chip: "Your marketing assistant",
  headline: "Like a marketing team you can talk to.",
  subtext:
    "Ask for what you need. Customer lists, a Mother's Day campaign, social posts for the week, a re-engagement sequence for slow weeks. Your assistant does the work and brings it back for you to review.",
};

export const AI_CHAT_DEMO = {
  assistantLabel: "AI Assistant",
  statusLabel: "Online",
  chatDemoLabel: "Scripted AI assistant chat demo",
  typingLabel: "AI is typing",
  initialDelayMs: 1900,
  typingSpeedMs: 35,
  aiTypingDelayMs: 800,
  aiLineRevealMs: 100,
  betweenTurnsMs: 0,
  finalPauseMs: 3000,
  resetFadeMs: 400,
  turns: [
    {
      id: "inactive-customers-query",
      speaker: "user",
      text: "Show me customers who haven't ordered in 30 days",
    },
    {
      id: "inactive-customers-results",
      speaker: "ai",
      lines: [
        { text: "Found 12 matching customers. Top 5 by value:" },
        { text: "Sarah K. — $4,280", kind: "customer" },
        { text: "Marcus T. — $3,150", kind: "customer" },
        { text: "Elena R. — $2,890", kind: "customer" },
        { text: "Send them a re-engagement campaign?", kind: "question" },
      ],
      typingDelayMs: 800,
      afterCompleteDelayMs: 1500,
    },
    {
      id: "spring-template-confirmation",
      speaker: "user",
      text: "Yes, use the spring template",
    },
    {
      id: "campaign-sent",
      speaker: "ai",
      lines: [
        {
          text: "Done! Campaign sent to 12 customers. Est. open rate: 34%",
          kind: "success",
        },
      ],
      typingDelayMs: 600,
    },
  ] satisfies AiChatTurnConfig[],
};

export const AI_CAPABILITY_CARDS_LABEL = "AI capability cards";

export const AI_CAPABILITY_CARDS: AiCapabilityCardConfig[] = [
  {
    icon: Calendar,
    title: "Plans the work",
    description:
      "Tell it what's coming up. Mother's Day, end of season, a slow Tuesday. Get a campaign brief, target audience, and ready-to-schedule copy back.",
    delayMs: 1400,
  },
  {
    icon: PenTool,
    title: "Drafts anything",
    description:
      "Email subjects, product descriptions, social posts, blog articles. Pick the channel and the angle. Get a draft in your store's voice.",
    delayMs: 1500,
  },
  {
    icon: Zap,
    title: "Handles the small stuff",
    description:
      "Tags new customers, sends follow-ups, posts restock alerts, replies to common reviews. The repetitive work that eats your week.",
    delayMs: 1600,
  },
  {
    icon: TrendingUp,
    title: "Watches the data",
    description:
      "Surfaces customers worth a phone call, campaigns worth repeating, and a daily summary of what changed. The reading you'd do if you had time.",
    delayMs: 1700,
  },
];
