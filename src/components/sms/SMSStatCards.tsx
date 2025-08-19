import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CreditCard, TrendingUp, MousePointer, Clock } from 'lucide-react';
import type { SMSStats } from '@/hooks/useSMSStats';

interface SMSStatCardsProps {
  stats: SMSStats;
  onCardClick: (cardType: string) => void;
}

export const SMSStatCards: React.FC<SMSStatCardsProps> = ({ stats, onCardClick }) => {
  const cards = [
    {
      key: 'subscribers',
      title: 'Subscribers',
      value: stats.subscribers.toLocaleString(),
      description: 'SMS opted-in customers',
      icon: Users,
      trend: '+12%',
      color: 'text-blue-600'
    },
    {
      key: 'credits',
      title: 'Credits',
      value: stats.credits.toLocaleString(),
      description: 'SMS credits remaining',
      icon: CreditCard,
      trend: null,
      color: 'text-green-600'
    },
    {
      key: 'deliverability',
      title: 'Deliverability',
      value: `${stats.deliverability}%`,
      description: 'Messages delivered',
      icon: TrendingUp,
      trend: '+2%',
      color: 'text-emerald-600'
    },
    {
      key: 'clicks',
      title: 'Clicks',
      value: stats.clicks.toLocaleString(),
      description: 'Total link clicks',
      icon: MousePointer,
      trend: '+8%',
      color: 'text-purple-600'
    },
    {
      key: 'queue',
      title: 'Queue',
      value: stats.queuedMessages.toString(),
      description: 'Messages queued',
      icon: Clock,
      trend: null,
      color: stats.queuedMessages > 0 ? 'text-orange-600' : 'text-gray-600'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card 
            key={card.key}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onCardClick(card.key)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{card.value}</div>
                {card.trend && (
                  <Badge variant="secondary" className="text-xs">
                    {card.trend}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};