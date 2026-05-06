import type { ComponentType, SVGProps } from "react";
import { Lightbulb, PenTool, TrendingUp, Zap } from "lucide-react";

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
  chip: "AI Powered",
  headline: "Intelligence Built In",
  subtext:
    "Every feature is powered by AI that learns, adapts, and works alongside you.",
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
    icon: TrendingUp,
    title: "Predict & Prevent",
    description:
      "Forecast demand, identify churn risk, and get actionable suggestions before issues surface.",
    delayMs: 1400,
  },
  {
    icon: PenTool,
    title: "AI Copywriter",
    description:
      "Email copy, product descriptions, and social posts — written in your brand voice automatically.",
    delayMs: 1500,
  },
  {
    icon: Zap,
    title: "24/7 Workflows",
    description:
      "Tag customers, send follow-ups, restock alerts, reply to reviews — all running autonomously.",
    delayMs: 1600,
  },
  {
    icon: Lightbulb,
    title: "Explained Analytics",
    description:
      "Revenue dipped? Your AI tells you why and recommends the next move.",
    delayMs: 1700,
  },
];
