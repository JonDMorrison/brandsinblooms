import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { TimelineChart } from '@/components/charts/TimelineChart';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, TrendingUp, Calendar, Tag, DollarSign } from 'lucide-react';

interface PurchaseValueBehaviorProps {
  metrics: {
    totalPurchases?: number;
    totalRevenue?: number;
    ltv?: number;
    aov?: number;
    purchaseFrequency?: number;
    avgDaysBetweenPurchases?: number;
    repeatPurchaseRate?: number;
    purchaseVelocity?: number;
    firstPurchaseDate?: string;
    lastPurchaseDate?: string;
    fullPricePercentage?: number;
    discountedPercentage?: number;
    consecutiveDiscountPurchases?: number;
  };
  categoryAffinity?: Array<{
    category: string;
    percentage: number;
    revenue: number;
  }>;
  purchaseTimeline?: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
  className?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const PurchaseValueBehavior: React.FC<PurchaseValueBehaviorProps> = ({
  metrics,
  categoryAffinity = [],
  purchaseTimeline = [],
  className,
}) => {
  const isVIP = (metrics.ltv || 0) > 500;
  const hasDiscountDependency = (metrics.consecutiveDiscountPurchases || 0) >= 3;

  // Sample data if none provided
  const timelineData = purchaseTimeline.length > 0 ? purchaseTimeline : [
    { date: 'Jan', orders: 2, revenue: 125 },
    { date: 'Feb', orders: 1, revenue: 67 },
    { date: 'Mar', orders: 3, revenue: 215 },
    { date: 'Apr', orders: 2, revenue: 142 },
    { date: 'May', orders: 4, revenue: 298 },
    { date: 'Jun', orders: 2, revenue: 178 },
  ];

  const categories = categoryAffinity.length > 0 ? categoryAffinity : [
    { category: 'Perennials', percentage: 45, revenue: 520 },
    { category: 'Fertilizers', percentage: 28, revenue: 324 },
    { category: 'Tools', percentage: 18, revenue: 208 },
    { category: 'Seeds', percentage: 9, revenue: 104 },
  ];

  return (
    <DashboardSection
      title="Purchase & Value Behavior"
      icon={<ShoppingCart className="h-4 w-4" />}
      tooltip="Comprehensive view of purchase patterns, value, and product preferences"
      badge={isVIP ? (
        <Badge className="ml-2 bg-purple-100 text-purple-700 border-purple-200 text-xs">
          💎 VIP Customer
        </Badge>
      ) : undefined}
      className={className}
    >
      {/* Purchase Timeline Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-foreground">Purchase Timeline</h4>
          <div className="text-right">
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(metrics.ltv || 0)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">LTV</span>
          </div>
        </div>
        <TimelineChart
          data={timelineData}
          height={180}
          showOrders={true}
          showRevenue={true}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Orders</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {metrics.totalPurchases || 0}
          </div>
        </div>
        
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">AOV</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(metrics.aov || 0)}
          </div>
        </div>
        
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Frequency</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {(metrics.purchaseFrequency || 0).toFixed(1)}/mo
          </div>
        </div>
        
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Avg Gap</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {metrics.avgDaysBetweenPurchases || 0}d
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Discount Behavior */}
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-3">Discount Behavior</h4>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Full Price</span>
                <span className="text-xs font-medium">{metrics.fullPricePercentage || 0}%</span>
              </div>
              <Progress value={metrics.fullPricePercentage || 0} className="h-2" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Discounted</span>
                <span className="text-xs font-medium">{metrics.discountedPercentage || 0}%</span>
              </div>
              <Progress value={metrics.discountedPercentage || 0} className="h-2" />
            </div>
          </div>
          
          {hasDiscountDependency && (
            <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs text-amber-700">
                  {metrics.consecutiveDiscountPurchases} consecutive discount purchases
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Category Affinity */}
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-3">Product Category Affinity</h4>
          
          <div className="space-y-2">
            {categories.slice(0, 4).map((cat, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{cat.category}</span>
                  <span className="text-xs text-muted-foreground">{cat.percentage}%</span>
                </div>
                <Progress 
                  value={cat.percentage} 
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Purchase Dates */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-xs text-muted-foreground">First Purchase</span>
          <div className="text-sm font-medium text-foreground mt-1">
            {formatDate(metrics.firstPurchaseDate || '')}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-xs text-muted-foreground">Last Purchase</span>
          <div className="text-sm font-medium text-foreground mt-1">
            {formatDate(metrics.lastPurchaseDate || '')}
          </div>
        </div>
      </div>
    </DashboardSection>
  );
};

export default PurchaseValueBehavior;
