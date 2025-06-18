
import * as React from "react";
import { useState } from "react";
import { PremiumButton } from "@/components/ui/premium-button";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, TrendingUp, Target } from "lucide-react";
import { HolidayContentModal } from "./HolidayContentModal";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  holiday_name: string;
  category: string;
  holiday_date: string;
  description: string;
  garden_relevance: string;
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
  const [showModal, setShowModal] = useState(false);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Month':
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-purple-500',
          text: 'text-white'
        };
      case 'Week':
        return {
          bg: 'bg-gradient-to-r from-green-500 to-teal-500',
          text: 'text-white'
        };
      case 'Day':
        return {
          bg: 'bg-gradient-to-r from-orange-500 to-red-500',
          text: 'text-white'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-500 to-gray-600',
          text: 'text-white'
        };
    }
  };

  const getSeasonalTheme = (holidayName: string, date: string) => {
    const month = new Date(date).getMonth();
    const lowerName = holidayName.toLowerCase();
    
    // Seasonal color schemes
    if (month >= 2 && month <= 4 || lowerName.includes('spring') || lowerName.includes('earth') || lowerName.includes('arbor')) {
      return {
        gradient: 'from-green-400 via-emerald-400 to-teal-400',
        accent: 'from-green-100 to-emerald-100'
      };
    } else if (month >= 5 && month <= 7 || lowerName.includes('summer') || lowerName.includes('rose') || lowerName.includes('garden')) {
      return {
        gradient: 'from-yellow-400 via-orange-400 to-red-400',
        accent: 'from-yellow-100 to-orange-100'
      };
    } else if (month >= 8 && month <= 10 || lowerName.includes('fall') || lowerName.includes('harvest')) {
      return {
        gradient: 'from-orange-400 via-red-400 to-yellow-400',
        accent: 'from-orange-100 to-red-100'
      };
    } else {
      return {
        gradient: 'from-blue-400 via-indigo-400 to-purple-400',
        accent: 'from-blue-100 to-indigo-100'
      };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    
    return { month, day, year };
  };

  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    const holidayDate = new Date(dateString);
    const diffTime = holidayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks`;
    return `${Math.ceil(diffDays / 30)} months`;
  };

  const handleGenerateClick = () => {
    setShowModal(true);
  };

  const categoryInfo = getCategoryColor(holiday.category);
  const seasonalTheme = getSeasonalTheme(holiday.holiday_name, holiday.holiday_date);
  const dateInfo = formatDate(holiday.holiday_date);
  const daysUntil = getDaysUntil(holiday.holiday_date);

  return (
    <>
      <div className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300',
        'hover:shadow-xl hover:border-gray-300 hover:-translate-y-1',
        isGenerating && 'opacity-75 pointer-events-none',
        className
      )}>
        <div className={cn(
          'h-3 bg-gradient-to-r',
          seasonalTheme.gradient
        )} />
        
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center min-w-[64px]">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  {dateInfo.month}
                </div>
                <div className="text-xl font-bold text-gray-800">
                  {dateInfo.day}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <HeadlineLarge className="text-gray-900 font-semibold line-clamp-1">
                    {holiday.holiday_name}
                  </HeadlineLarge>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    categoryInfo.bg,
                    categoryInfo.text
                  )}>
                    {holiday.category}
                  </Badge>
                  
                  <CaptionMedium className="text-gray-500 font-medium">
                    {daysUntil === 'Past' ? 'Past' : `In ${daysUntil}`}
                  </CaptionMedium>
                </div>
              </div>
            </div>
          </div>

          <BodyMedium className="text-gray-700 mb-4 line-clamp-2">
            {holiday.description}
          </BodyMedium>

          <div className={cn(
            'rounded-xl p-4 mb-5 border-2 border-dashed bg-gradient-to-r',
            seasonalTheme.accent
          )}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <CaptionMedium className="font-semibold text-gray-800 mb-1">
                  Marketing Opportunity
                </CaptionMedium>
                <CaptionMedium className="text-gray-700 leading-relaxed">
                  {holiday.garden_relevance}
                </CaptionMedium>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <PremiumButton
              variant="primary"
              size="default"
              leadingIcon="sparkles"
              premium={true}
              disabled={isGenerating}
              onClick={handleGenerateClick}
              className="w-full max-w-xs"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                'Generate Content'
              )}
            </PremiumButton>
          </div>
        </div>

        <div className={cn(
          'absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none',
          seasonalTheme.gradient
        )} />
      </div>

      <HolidayContentModal
        holiday={holiday}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onGenerateContent={onGenerateContent}
      />
    </>
  );
};
