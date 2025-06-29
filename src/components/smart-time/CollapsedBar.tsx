
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsedBarProps {
  weekLabel: string;
  bestTimes: string[];
  onExpand: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export const CollapsedBar = ({ 
  weekLabel, 
  bestTimes, 
  onExpand,
  onPrevWeek,
  onNextWeek
}: CollapsedBarProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={false}
      aria-label="Expand scheduler"
      className="smartDockCollapsed smartDockTransition cursor-pointer"
      onClick={onExpand}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onPrevWeek();
            }}
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          
          <span className="text-sm font-medium text-white min-w-[120px] text-center">
            {weekLabel}
          </span>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onNextWeek();
            }}
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        {/* Best Time Pills */}
        <div className="flex items-center gap-2">
          {bestTimes.slice(0, 2).map((timeSlot, index) => (
            <div
              key={index}
              className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                "bg-[#3E5A6B]/20 text-white"
              )}
            >
              {timeSlot}
            </div>
          ))}
          {bestTimes.length === 0 && (
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-[#3E5A6B]/20 text-white">
              Drag drafts to schedule
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
