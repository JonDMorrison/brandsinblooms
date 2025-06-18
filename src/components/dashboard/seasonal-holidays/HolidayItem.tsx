
import * as React from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  holiday_name: string;
  category: 'Month' | 'Week' | 'Day';
  holiday_date: string;
  description: string;
}

interface HolidayItemProps {
  holiday: Holiday;
  onGenerateContent: (holidayId: string) => Promise<void>;
  isGenerating?: boolean;
  className?: string;
}

export const HolidayItem = ({
  holiday,
  onGenerateContent,
  isGenerating = false,
  className
}: HolidayItemProps) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Month':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Week':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Day':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeasonalEmoji = (holidayName: string) => {
    const emojiMap: { [key: string]: string } = {
      'Earth Day': '🌍',
      'Arbor Day': '🌳',
      'World Bee Day': '🐝',
      'National Rose Day': '🌹',
      'National Garden Month': '🌱',
      'National Flower Month': '🌸',
      'National Indoor Plant Month': '🪴',
      'National Bird-Feeding Month': '🐦'
    };
    
    // Check for partial matches
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
        return emoji;
      }
    }
    
    return '🌿';
  };

  const handleGenerateClick = async () => {
    try {
      await onGenerateContent(holiday.id);
    } catch (error) {
      console.error('Error generating content:', error);
    }
  };

  return (
    <EnhancedAppleCard
      variant="default"
      surface="primary"
      hoverEffect="subtle"
      animated={true}
      className={cn(
        'border-l-4 border-l-green-400 transition-all duration-300',
        isGenerating && 'opacity-75',
        className
      )}
    >
      <AppleCardContent className="apple-card-spacing">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getSeasonalEmoji(holiday.holiday_name)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn('text-xs', getCategoryColor(holiday.category))}>
                  <Calendar className="w-3 h-3 mr-1" />
                  {holiday.holiday_date}
                </Badge>
              </div>
              <HeadlineMedium className="apple-headline-medium text-gray-800">
                {holiday.holiday_name}
              </HeadlineMedium>
            </div>
          </div>
        </div>

        <BodyMedium className="apple-body-enhanced text-gray-600 mb-3">
          {holiday.description}
        </BodyMedium>

        <div className="bg-green-50 rounded-lg p-3 mb-4 border border-green-100">
          <CaptionMedium className="apple-caption-enhanced text-green-800 font-medium mb-1">
            🌱 Garden Center Opportunity
          </CaptionMedium>
          <CaptionMedium className="apple-caption-enhanced text-green-700">
            Perfect timing for seasonal promotions and themed content campaigns
          </CaptionMedium>
        </div>

        <div className="flex justify-end">
          <PremiumButton
            variant="primary"
            size="sm"
            leadingIcon="sparkles"
            premium={true}
            disabled={isGenerating}
            onClick={handleGenerateClick}
            className="apple-button-premium"
          >
            {isGenerating ? 'Generating...' : 'Generate Content'}
          </PremiumButton>
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
