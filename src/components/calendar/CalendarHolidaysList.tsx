import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSeasonalHolidays } from '@/hooks/useSeasonalHolidays';
import { Calendar, Sparkles, Clock, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface CalendarHolidaysListProps {
  onHolidayAction: (holiday: any, action: string) => void;
}

export const CalendarHolidaysList = ({ onHolidayAction }: CalendarHolidaysListProps) => {
  const { allHolidays, holidayContentState, loading } = useSeasonalHolidays();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading holidays...</div>
      </div>
    );
  }

  if (allHolidays.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No upcoming holidays found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {allHolidays.slice(0, 10).map(holiday => {
        const contentState = holidayContentState[holiday.id];
        const daysUntil = differenceInDays(new Date(holiday.holiday_date), new Date());
        const isUrgent = daysUntil <= 7;
        
        return (
          <Card key={holiday.id} className={`${isUrgent ? 'border-orange-200 bg-orange-50/50' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-sm font-medium text-foreground">
                    {holiday.holiday_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={isUrgent ? "destructive" : "secondary"} className="text-xs">
                      {daysUntil === 0 ? 'Today' : 
                       daysUntil === 1 ? 'Tomorrow' : 
                       daysUntil > 0 ? `${daysUntil} days` : 'Past'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(holiday.holiday_date), 'MMM d')}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {holiday.description && (
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {holiday.description.length > 80 
                    ? holiday.description.substring(0, 80) + '...'
                    : holiday.description
                  }
                </p>
              )}
              
              <div className="flex flex-col gap-2">
                {contentState?.hasContent ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-700 font-medium">
                      {contentState.contentCount}/5 content pieces ready
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {contentState?.contentCount || 0}/5 pieces created
                    </span>
                  </div>
                )}
                
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onHolidayAction(holiday, 'generate')}
                    className="h-6 px-2 text-xs flex-1"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Generate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onHolidayAction(holiday, 'schedule')}
                    className="h-6 px-2 text-xs flex-1"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Schedule
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};