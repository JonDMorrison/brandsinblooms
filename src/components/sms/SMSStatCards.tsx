import React from "react";
import { Card, CardContent } from "@/components/ui-legacy/card";
import {
  Clock,
  MessageSquare,
  MousePointerClick,
  TrendingUp,
  Users,
} from "lucide-react";
import type { SMSStats } from "@/hooks/useSMSStats";
import { cn } from "@/lib/utils";

interface SMSStatCardsProps {
  stats: SMSStats;
  onCardClick: (cardType: string) => void;
}

export const SMSStatCards: React.FC<SMSStatCardsProps> = ({
  stats,
  onCardClick,
}) => {
  const formatTrend = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const cards = [
    {
      key: "subscribers",
      title: "Subscribers",
      value: stats.subscribers.toLocaleString(),
      description: "SMS opted-in audience",
      icon: Users,
      trend: formatTrend(stats.subscribersGrowth),
      iconClassName: "text-blue-500",
      iconSurfaceClassName: "bg-blue-50",
      trendClassName: "bg-blue-50 text-blue-600",
    },
    {
      key: "credits",
      title: "Credits",
      value: stats.credits.toLocaleString(),
      description: `${stats.creditsUsed} used this month`,
      icon: MessageSquare,
      trend: null,
      iconClassName: "text-emerald-500",
      iconSurfaceClassName: "bg-emerald-50",
      trendClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      key: "deliverability",
      title: "Deliverability",
      value: `${stats.deliverability}%`,
      description: "Messages delivered",
      icon: TrendingUp,
      trend: formatTrend(stats.deliverabilityGrowth),
      iconClassName: "text-purple-500",
      iconSurfaceClassName: "bg-purple-50",
      trendClassName: "bg-purple-50 text-purple-600",
    },
    {
      key: "clicks",
      title: "Clicks",
      value: stats.clicks.toLocaleString(),
      description: "Total link clicks",
      icon: MousePointerClick,
      trend: formatTrend(stats.clicksGrowth),
      iconClassName: "text-amber-500",
      iconSurfaceClassName: "bg-amber-50",
      trendClassName: "bg-amber-50 text-amber-600",
    },
    {
      key: "queue",
      title: "Queue",
      value: stats.queuedMessages.toString(),
      description: "Messages queued",
      icon: Clock,
      trend: null,
      iconClassName: "text-gray-500",
      iconSurfaceClassName: "bg-gray-50",
      trendClassName: "bg-gray-100 text-gray-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.key}
            className={cn(
              "cursor-pointer rounded-[24px] border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              index === cards.length - 1 && "col-span-2 md:col-span-1",
            )}
            onClick={() => onCardClick(card.key)}
          >
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gray-400">
                    {card.title}
                  </p>
                  <div className="text-3xl font-bold tracking-tight text-gray-900">
                    {card.value}
                  </div>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    card.iconSurfaceClassName,
                  )}
                >
                  <Icon className={cn("h-5 w-5", card.iconClassName)} />
                </div>
              </div>

              <div className="flex min-h-[32px] items-end justify-between gap-3">
                <p className="text-xs text-gray-500">{card.description}</p>
                {card.trend ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      card.trendClassName,
                    )}
                  >
                    {card.trend}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
