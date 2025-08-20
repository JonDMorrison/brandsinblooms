import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Calendar, Filter } from 'lucide-react';
import { CalendarPlanningFilters } from './CalendarPlanningFilters';
import { CalendarHolidaysList } from './CalendarHolidaysList';
import { MASTER_WEEKLY_THEMES } from '@/data/masterWeeklyThemes';

interface CalendarPlanningPanelProps {
  filters: any;
  onFiltersChange: (filters: any) => void;
  filterOptions: {
    types: string[];
    platforms: string[];
    statuses: string[];
  };
  onThemeSchedule: (theme: any, date: Date) => void;
  onHolidayAction: (holiday: any, action: string) => void;
}

export const CalendarPlanningPanel = ({
  filters,
  onFiltersChange,
  filterOptions,
  onThemeSchedule,
  onHolidayAction
}: CalendarPlanningPanelProps) => {
  const [activeTab, setActiveTab] = useState('ideas');

  return (
    <div className="w-80 bg-background border-l border-border">
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Planning Hub
          </h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="ideas" className="text-sm">
              <Lightbulb className="w-4 h-4 mr-1" />
              Ideas
            </TabsTrigger>
            <TabsTrigger value="holidays" className="text-sm">
              <Calendar className="w-4 h-4 mr-1" />
              Holidays
            </TabsTrigger>
            <TabsTrigger value="filters" className="text-sm">
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="ideas" className="h-full m-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-primary flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Weekly Themes (52 Ideas)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {MASTER_WEEKLY_THEMES.map((theme) => (
                          <div 
                            key={theme.week_number} 
                            className="p-2 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => onThemeSchedule(theme, new Date())}
                          >
                            <div className="text-xs font-medium text-slate-700">
                              Week {theme.week_number}
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {theme.title}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {theme.seasonal_focus}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Quick Ideas</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Behind-the-scenes content</p>
                        <p>• Customer testimonials</p>
                        <p>• Product education posts</p>
                        <p>• Seasonal tips & advice</p>
                        <p>• Community highlights</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="holidays" className="h-full m-0 p-4">
              <ScrollArea className="h-full">
                <CalendarHolidaysList onHolidayAction={onHolidayAction} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="filters" className="h-full m-0 p-4">
              <ScrollArea className="h-full">
                <CalendarPlanningFilters
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  filterOptions={filterOptions}
                />
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};