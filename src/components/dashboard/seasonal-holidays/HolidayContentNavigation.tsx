
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPostTypeIcon } from '@/components/content/ContentViewerUtils';
import { getStatusBadgeVariant, getPlatformLabel, getStatusLabel } from '@/utils/badgeUtils';
import { cn } from '@/lib/utils';

interface ContentTask {
  id: string;
  post_type: string;
  ai_output: string;
  status: string;
  created_at: string;
  notes?: string;
  image_idea?: string;
  hashtags?: string;
}

interface HolidayContentNavigationProps {
  contentTypes: string[];
  tasksByType: Record<string, ContentTask>;
  activeSection: string;
  onSectionClick: (sectionType: string) => void;
}

export const HolidayContentNavigation = ({
  contentTypes,
  tasksByType,
  activeSection,
  onSectionClick
}: HolidayContentNavigationProps) => {
  return (
    <div className="p-4 space-y-2">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Content Types</h4>
      {contentTypes.map(type => {
        const task = tasksByType[type];
        const isAvailable = !!task;
        const isActive = activeSection === type;
        
        return (
          <Button
            key={type}
            variant="ghost"
            onClick={() => onSectionClick(type)}
            className={cn(
              "w-full justify-start p-3 h-auto flex-col items-start gap-2",
              isActive && "bg-green-50 text-green-700 border border-green-200"
            )}
          >
            <div className="flex items-center gap-2 w-full">
              {getPostTypeIcon(type)}
              <span className="font-medium capitalize text-sm">
                {getPlatformLabel(type)}
              </span>
            </div>
            
            {isAvailable && (
              <Badge 
                variant={getStatusBadgeVariant(task.status)}
                className="text-xs"
              >
                {getStatusLabel(task.status)}
              </Badge>
            )}
            
            {!isAvailable && (
              <span className="text-xs text-gray-400">Not available</span>
            )}
          </Button>
        );
      })}
    </div>
  );
};
