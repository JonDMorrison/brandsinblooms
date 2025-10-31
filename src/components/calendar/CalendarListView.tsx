import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { UnifiedCalendarEvent } from '@/hooks/useUnifiedCalendarData';
import { 
  Calendar, 
  Clock, 
  Mail, 
  Megaphone, 
  FileText, 
  Instagram, 
  Facebook,
  PartyPopper 
} from 'lucide-react';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

interface CalendarListViewProps {
  events: UnifiedCalendarEvent[];
  onEventClick: (event: UnifiedCalendarEvent) => void;
  selectedEvents?: string[];
  onToggleSelect?: (eventId: string) => void;
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'task':
      return FileText;
    case 'scheduled_post':
      return Instagram;
    case 'newsletter':
      return Mail;
    case 'event':
      return Megaphone;
    case 'holiday':
      return PartyPopper;
    default:
      return FileText;
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'task':
      return 'from-blue-500 to-cyan-600';
    case 'scheduled_post':
      return 'from-pink-500 to-purple-600';
    case 'newsletter':
      return 'from-green-500 to-teal-600';
    case 'event':
      return 'from-orange-500 to-red-600';
    case 'holiday':
      return 'from-yellow-500 to-orange-600';
    default:
      return 'from-gray-500 to-slate-600';
  }
};

const getDateLabel = (date: Date) => {
  if (isToday(date)) {
    return 'Today';
  } else if (isTomorrow(date)) {
    return 'Tomorrow';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'EEEE, MMMM d');
  }
};

export const CalendarListView = ({ events, onEventClick, selectedEvents, onToggleSelect }: CalendarListViewProps) => {
  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = format(event.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, UnifiedCalendarEvent[]>);

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort();

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No events found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or date range</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        {sortedDates.map(dateKey => {
          const date = new Date(dateKey);
          const dayEvents = eventsByDate[dateKey];
          
          return (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {getDateLabel(date)}
                </h3>
                <Badge variant="secondary" className="ml-auto">
                  {dayEvents.length} {dayEvents.length === 1 ? 'item' : 'items'}
                </Badge>
              </div>
              
              <div className="grid gap-3">
                {dayEvents.map(event => {
                  const IconComponent = getEventIcon(event.type);
                  const colorClass = getEventColor(event.type);
                  
                  return (
                    <Card 
                      key={event.id}
                      className={`cursor-pointer hover:shadow-md transition-all duration-200 border-2 hover:border-primary/20 ${
                        selectedEvents?.includes(event.id) ? 'border-blue-500 bg-blue-50/50' : ''
                      }`}
                      onClick={() => onEventClick(event)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Checkbox for selection (only for tasks) */}
                          {onToggleSelect && event.type === 'task' && (
                            <Checkbox
                              checked={selectedEvents?.includes(event.id) || false}
                              onCheckedChange={(checked) => {
                                onToggleSelect(event.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          )}
                          
                          <div className={`p-2 bg-gradient-to-br ${colorClass} rounded-lg shadow-sm`}>
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-foreground truncate">
                                  {event.title}
                                </h4>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span className="capitalize">
                                    {event.type.replace('_', ' ')}
                                  </span>
                                  {event.platform && (
                                    <Badge variant="outline" className="text-xs">
                                      {event.platform}
                                    </Badge>
                                  )}
                                  {event.status && (
                                    <Badge 
                                      variant={
                                        event.status === 'completed' || event.status === 'PUBLISHED' || event.status === 'sent' 
                                          ? 'default' 
                                          : 'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {event.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {event.time && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
                                  <Clock className="w-3 h-3" />
                                  {event.time}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};