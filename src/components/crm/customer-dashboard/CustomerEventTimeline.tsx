import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Mail, 
  MessageSquare, 
  ShoppingCart, 
  Gift,
  Star,
  AlertTriangle,
  UserPlus,
  Tag,
  Eye,
  MousePointer,
  Filter,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TimelineEvent {
  id: string;
  type: 'signup' | 'email_sent' | 'email_open' | 'email_click' | 'sms_sent' | 'sms_click' | 
        'purchase' | 'redemption' | 'loyalty' | 'opt_out' | 'risk' | 'stage_change';
  timestamp: string;
  title: string;
  description?: string;
  impact: 'positive' | 'neutral' | 'negative';
  metadata?: Record<string, any>;
}

interface CustomerEventTimelineProps {
  events: TimelineEvent[];
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

const eventConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  signup: { 
    icon: <UserPlus className="h-4 w-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  email_sent: { 
    icon: <Mail className="h-4 w-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  email_open: { 
    icon: <Eye className="h-4 w-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  email_click: { 
    icon: <MousePointer className="h-4 w-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  sms_sent: { 
    icon: <MessageSquare className="h-4 w-4" />, 
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  sms_click: { 
    icon: <MousePointer className="h-4 w-4" />, 
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  purchase: { 
    icon: <ShoppingCart className="h-4 w-4" />, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  redemption: { 
    icon: <Tag className="h-4 w-4" />, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-100'
  },
  loyalty: { 
    icon: <Star className="h-4 w-4" />, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  opt_out: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  risk: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  stage_change: { 
    icon: <Gift className="h-4 w-4" />, 
    color: 'text-teal-600',
    bgColor: 'bg-teal-100'
  },
};

const impactBadgeStyles = {
  positive: 'bg-green-100 text-green-700 border-green-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  negative: 'bg-red-100 text-red-700 border-red-200',
};

const formatTimeDelta = (current: Date, previous: Date): string => {
  const diffMs = current.getTime() - previous.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  return 'Just now';
};

const formatEventDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const eventTypes = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'purchase', label: 'Purchases' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'risk', label: 'Risk Events' },
];

export const CustomerEventTimeline: React.FC<CustomerEventTimelineProps> = ({
  events,
  className,
  onLoadMore,
  hasMore = false,
  loading = false,
}) => {
  const [filters, setFilters] = useState<string[]>([]);

  const filteredEvents = filters.length === 0 
    ? events 
    : events.filter(event => {
        if (filters.includes('email') && event.type.startsWith('email')) return true;
        if (filters.includes('sms') && event.type.startsWith('sms')) return true;
        if (filters.includes('purchase') && event.type === 'purchase') return true;
        if (filters.includes('loyalty') && (event.type === 'loyalty' || event.type === 'redemption')) return true;
        if (filters.includes('risk') && (event.type === 'risk' || event.type === 'opt_out')) return true;
        return false;
      });

  const toggleFilter = (key: string) => {
    setFilters(prev => 
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  return (
    <DashboardSection
      title="Customer Story Timeline"
      icon={<History className="h-4 w-4" />}
      tooltip="Chronological view of all customer interactions and events"
      variant="highlight"
      badge={
        <Badge variant="secondary" className="ml-2 text-xs">
          {events.length} events
        </Badge>
      }
      className={className}
    >
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filter
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {filters.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {eventTypes.map(type => (
              <DropdownMenuCheckboxItem
                key={type.key}
                checked={filters.includes(type.key)}
                onCheckedChange={() => toggleFilter(type.key)}
              >
                {type.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {filters.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFilters([])}
            className="text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Timeline */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events match the current filter</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEvents.map((event, index) => {
                const config = eventConfig[event.type] || eventConfig.signup;
                const prevEvent = index < filteredEvents.length - 1 ? filteredEvents[index + 1] : null;
                const timeDelta = prevEvent 
                  ? formatTimeDelta(new Date(event.timestamp), new Date(prevEvent.timestamp))
                  : null;

                return (
                  <div key={event.id} className="relative pl-10">
                    {/* Event icon */}
                    <div className={cn(
                      'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center z-10',
                      config.bgColor,
                      config.color
                    )}>
                      {config.icon}
                    </div>
                    
                    {/* Event card */}
                    <div className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">
                              {event.title}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn('text-[10px]', impactBadgeStyles[event.impact])}
                            >
                              {event.impact}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatEventDate(event.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Time delta connector */}
                    {timeDelta && (
                      <div className="flex items-center gap-1 py-1 pl-1">
                        <div className="w-2 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground italic">
                          {timeDelta} later
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More Events'}
            </Button>
          </div>
        )}
      </ScrollArea>
    </DashboardSection>
  );
};

export default CustomerEventTimeline;
