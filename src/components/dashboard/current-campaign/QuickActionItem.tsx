
import React from "react";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface QuickActionItemProps {
  item: {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    benefit: string;
    color: string;
    bgColor: string;
    borderColor: string;
    onClick: () => void;
    ariaLabel: string;
  };
}

export const QuickActionItem = ({ item }: QuickActionItemProps) => {
  const IconComponent = item.icon;

  return (
    <div
      className={cn(
        "w-full border rounded-lg p-4 cursor-pointer transition-all duration-200",
        item.bgColor,
        item.borderColor,
        "hover:shadow-sm"
      )}
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      aria-label={item.ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick();
        }
      }}
    >
      <div className="flex items-start space-x-3">
        <div className={cn(
          "flex-shrink-0 p-2 rounded-lg transition-colors",
          "bg-gray-50 hover:bg-gray-100"
        )}>
          <IconComponent className={cn("w-5 h-5", item.color)} />
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <BodyMedium className="text-gray-800 font-medium">
            {item.title}
          </BodyMedium>
          
          <BodyMedium className="text-gray-600">
            {item.description}
          </BodyMedium>
          
          <CaptionMedium className="text-gray-500">
            {item.benefit}
          </CaptionMedium>
        </div>
      </div>
    </div>
  );
};
