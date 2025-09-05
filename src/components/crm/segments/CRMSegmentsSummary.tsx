import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Crown, UserPlus, Clock, ShoppingBag, Repeat } from 'lucide-react';
import { useSegmentCounts } from '@/hooks/useSegmentCounts';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/ui/link';

const segmentConfig = [
  {
    key: 'high-value' as const,
    label: 'High-Value',
    icon: Crown,
    description: 'Customers with $500+ spent',
    color: 'text-yellow-600',
  },
  {
    key: 'new-customers' as const,
    label: 'New Customers',
    icon: UserPlus,
    description: 'Joined in last 30 days',
    color: 'text-green-600',
  },
  {
    key: 'loyalty-members' as const,
    label: 'Loyalty Members',
    icon: Users,
    description: 'Part of loyalty program',
    color: 'text-blue-600',
  },
  {
    key: 'lapsed-customers' as const,
    label: 'Lapsed Customers',
    icon: Clock,
    description: 'No purchase in 90+ days',
    color: 'text-red-600',
  },
  {
    key: 'seasonal-shoppers' as const,
    label: 'Seasonal Shoppers',
    icon: ShoppingBag,
    description: 'Holiday and seasonal buyers',
    color: 'text-purple-600',
  },
  {
    key: 'frequent-buyers' as const,
    label: 'Frequent Buyers',
    icon: Repeat,
    description: '3+ orders in history',
    color: 'text-indigo-600',
  },
];

export const CRMSegmentsSummary = () => {
  const { counts, loading } = useSegmentCounts();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                <div className="h-6 bg-muted animate-pulse rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCustomers = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Customer Segments
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <NavLink to="/crm/segments">
            View All Segments
          </NavLink>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {segmentConfig.map((segment) => {
            const count = counts[segment.key] || 0;
            const percentage = totalCustomers > 0 ? (count / totalCustomers) * 100 : 0;
            
            return (
              <div key={segment.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <segment.icon className={`w-4 h-4 ${segment.color}`} />
                  <span className="text-sm font-medium">{segment.label}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{count.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% of total
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {segment.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalCustomers === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No customer segments yet</p>
            <p className="text-sm">Import customers to see segment breakdowns</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};