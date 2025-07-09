
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED' | 'REVIEW';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface CalendarRibbonProps {
  selectedContent: GeneratedContent | null;
  onReschedule: (contentId: string, newDate: Date) => void;
}

export const CalendarRibbon = ({ selectedContent, onReschedule }: CalendarRibbonProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [draggedContent, setDraggedContent] = useState<GeneratedContent | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const prevWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));

  const handleDragStart = (e: React.DragEvent, content: GeneratedContent) => {
    setDraggedContent(content);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (draggedContent) {
      onReschedule(draggedContent.id, date);
      setDraggedContent(null);
    }
  };

  const getDayName = (date: Date) => format(date, 'EEE');
  const getDayNumber = (date: Date) => format(date, 'd');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg border-t border-gray-200 p-4 z-40">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#3E5A6B]">Schedule Calendar</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-gray-600 min-w-[120px] text-center">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="ghost" size="sm" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => (
            <div
              key={index}
              className={cn(
                "min-h-[80px] p-3 rounded-lg border-2 border-dashed transition-colors",
                "bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5",
                "hover:border-[#68BEB9]/50 hover:bg-[#68BEB9]/10"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className="text-center">
                <div className="text-xs font-medium text-[#3E5A6B] mb-1">
                  {getDayName(day)}
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {getDayNumber(day)}
                </div>
              </div>

              {/* Scheduled content would appear here */}
              {selectedContent && selectedContent.status === 'SCHEDULED' && index === 2 && (
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, selectedContent)}
                  className="mt-2 p-2 bg-[#68BEB9] text-white rounded text-xs cursor-move hover:bg-[#56a7a1] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-white/20 rounded flex-shrink-0"></div>
                    <span className="truncate">
                      {selectedContent.caption.substring(0, 20)}...
                    </span>
                  </div>
                  <div className="text-[10px] opacity-75 mt-1">2:00 PM</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedContent && (
          <div className="mt-4 p-3 bg-[#68BEB9]/5 rounded-lg border border-[#68BEB9]/20">
            <p className="text-sm text-[#3E5A6B]">
              <span className="font-medium">Tip:</span> Drag the content pill to reschedule, or use the drawer to set a specific time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
