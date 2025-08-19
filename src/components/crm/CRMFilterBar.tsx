import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, Users, Mail } from 'lucide-react';
import { TimeFilterToggle } from '@/components/crm/analytics/TimeFilterToggle';

type TimeFilter = '7d' | '30d' | 'all';
type SegmentFilter = 'all' | 'high-value' | 'new-customers' | 'loyalty-members';
type ChannelFilter = 'all' | 'email' | 'sms' | 'social';

interface CRMFilterBarProps {
  timeFilter: TimeFilter;
  segmentFilter: SegmentFilter;
  channelFilter: ChannelFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  onSegmentFilterChange: (filter: SegmentFilter) => void;
  onChannelFilterChange: (filter: ChannelFilter) => void;
  onResetFilters: () => void;
}

const segmentOptions = [
  { value: 'all' as const, label: 'All Segments', icon: Users },
  { value: 'high-value' as const, label: 'High-Value', icon: Users },
  { value: 'new-customers' as const, label: 'New Customers', icon: Users },
  { value: 'loyalty-members' as const, label: 'Loyalty Members', icon: Users },
];

const channelOptions = [
  { value: 'all' as const, label: 'All Channels', icon: Filter },
  { value: 'email' as const, label: 'Email', icon: Mail },
  { value: 'sms' as const, label: 'SMS', icon: Mail },
  { value: 'social' as const, label: 'Social', icon: Mail },
];

export const CRMFilterBar = ({
  timeFilter,
  segmentFilter,
  channelFilter,
  onTimeFilterChange,
  onSegmentFilterChange,
  onChannelFilterChange,
  onResetFilters,
}: CRMFilterBarProps) => {
  const hasActiveFilters = segmentFilter !== 'all' || channelFilter !== 'all' || timeFilter !== '30d';

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <TimeFilterToggle value={timeFilter} onChange={onTimeFilterChange} />
      </div>

      <div className="flex items-center gap-1 p-1 bg-background rounded-lg border">
        {segmentOptions.map((option) => (
          <Button
            key={option.value}
            variant={segmentFilter === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSegmentFilterChange(option.value)}
            className="text-xs"
          >
            <option.icon className="w-3 h-3 mr-1" />
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1 p-1 bg-background rounded-lg border">
        {channelOptions.map((option) => (
          <Button
            key={option.value}
            variant={channelFilter === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChannelFilterChange(option.value)}
            className="text-xs"
          >
            <option.icon className="w-3 h-3 mr-1" />
            {option.label}
          </Button>
        ))}
      </div>

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onResetFilters}
          className="text-xs"
        >
          <Filter className="w-3 h-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
};