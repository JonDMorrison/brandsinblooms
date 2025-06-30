
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

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
  return (
    <div className="smartDockCollapsed">
      <div className="flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onPrevWeek} className="text-white hover:bg-white/20">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="text-white">
            <span className="font-medium text-sm">{weekLabel}</span>
            {bestTimes.length > 0 && (
              <span className="ml-3 text-xs opacity-80">
                Best times: {bestTimes.join(', ')}
              </span>
            )}
          </div>
          
          <Button variant="ghost" size="sm" onClick={onNextWeek} className="text-white hover:bg-white/20">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <Button variant="ghost" size="sm" onClick={onExpand} className="text-white hover:bg-white/20">
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
