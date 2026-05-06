import type { ComponentType, SVGProps } from "react";
import { PenTool, TrendingUp, Zap } from "lucide-react";

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
  chip: "AI",
  headline: "AI that knows your customers.",
  subtext:
    "Trained on your sales history and brand voice. It drafts, segments, and suggests. You approve.",
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
    title: "Forecast and prevent",
    description:
      "Spot churn risk, forecast Mother's Day demand, and flag inventory shortfalls before they hit the floor.",
    delayMs: 1400,
  },
  {
    icon: PenTool,
    title: "AI copywriter",
    description:
      "Email subject lines, product descriptions, and social posts in your brand voice. You review, AI drafts.",
    delayMs: 1500,
  },
  {
    icon: Zap,
    title: "24/7 workflows",
    description:
      "Tag new customers, send follow-ups, post restock alerts, and reply to reviews. Automatic and always on.",
    delayMs: 1600,
  },
];
