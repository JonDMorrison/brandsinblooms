import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TimeRange = '7d' | '30d' | '90d' | 'lifetime';

interface CustomerDashboardLayoutProps {
  children: React.ReactNode;
  customerName?: string;
  customerId?: string;
  onTimeRangeChange?: (range: TimeRange) => void;
  selectedTimeRange?: TimeRange;
  className?: string;
}

export const CustomerDashboardLayout: React.FC<CustomerDashboardLayoutProps> = ({
  children,
  customerName,
  customerId,
  onTimeRangeChange,
  selectedTimeRange = '30d',
  className,
}) => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>(selectedTimeRange);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Back button and title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/crm/customers')}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Customers</span>
              </Button>
              {customerName && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <h1 className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
                    {customerName}
                  </h1>
                </div>
              )}
            </div>

            {/* Right: Time range selector and actions */}
            <div className="flex items-center gap-2">
              <Tabs
                value={timeRange}
                onValueChange={(v) => handleTimeRangeChange(v as TimeRange)}
                className="hidden sm:block"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs px-2.5">7d</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs px-2.5">30d</TabsTrigger>
                  <TabsTrigger value="90d" className="text-xs px-2.5">90d</TabsTrigger>
                  <TabsTrigger value="lifetime" className="text-xs px-2.5">All</TabsTrigger>
                </TabsList>
              </Tabs>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboardLayout;
