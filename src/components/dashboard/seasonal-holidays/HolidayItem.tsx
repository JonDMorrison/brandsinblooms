
import React from 'react';
import { EnhancedAppleCard } from '@/components/ui/enhanced-apple-card';
import { AppleCardHeader, AppleCardContent } from '@/components/ui/apple-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeadlineLarge, BodyMedium, CaptionMedium } from '@/components/ui/typography';
import { Sparkles, Eye, Loader2, Instagram, Facebook, FileText, Video, Mail } from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';

interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description?: string;
  garden_relevance?: string;
  category?: string;
}

interface HolidayContentState {
  hasContent: boolean;
  contentCount: number;
  lastGenerated?: string;
}

interface HolidayItemProps {
  holiday: Holiday;
  onGenerateContent: (holidayId: string) => void;
  onViewContent: (holidayId: string, holidayName: string) => void;
  isGenerating: boolean;
  contentState?: HolidayContentState;
}

export const HolidayItem = ({
  holiday,
  onGenerateContent,
  onViewContent,
  isGenerating,
  contentState
}: HolidayItemProps) => {
  const holidayDate = new Date(holiday.holiday_date);
  const daysUntil = differenceInDays(holidayDate, new Date());
  
  const getDateDisplay = () => {
    if (isToday(holidayDate)) return 'Today';
    if (isTomorrow(holidayDate)) return 'Tomorrow';
    if (daysUntil > 0) return `${daysUntil} days away`;
    return format(holidayDate, 'MMM d, yyyy');
  };

  const getUrgencyColor = () => {
    if (daysUntil <= 3) return 'text-red-600 bg-red-50 border-red-200';
    if (daysUntil <= 7) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const contentIcons = [
    { icon: Instagram, label: 'Instagram', color: 'text-pink-500' },
    { icon: Facebook, label: 'Facebook', color: 'text-blue-600' },
    { icon: FileText, label: 'Blog', color: 'text-green-600' },
    { icon: Video, label: 'Video', color: 'text-red-500' },
    { icon: Mail, label: 'Newsletter', color: 'text-purple-600' }
  ];

  const hasAnyContent = contentState && contentState.contentCount > 0;
  const contentProgress = contentState ? `${contentState.contentCount} of 5` : '0 of 5';

  // Extract month and day for custom calendar icon
  const monthAbbr = format(holidayDate, 'MMM').toUpperCase();
  const dayNumber = format(holidayDate, 'd');

  return (
    <EnhancedAppleCard
      variant="elevated"
      surface="primary"
      hoverEffect="subtle"
      animated={true}
      className="h-full"
    >
      <AppleCardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl border border-green-200">
              <div className="text-[9px] font-semibold text-green-700 leading-none mb-0.5">
                {monthAbbr}
              </div>
              <div className="text-sm font-bold text-green-800 leading-none">
                {dayNumber}
              </div>
            </div>
            <div>
              <HeadlineLarge className="text-gray-900 text-lg font-semibold">
                {holiday.holiday_name}
              </HeadlineLarge>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium border ${getUrgencyColor()}`}
                >
                  {getDateDisplay()}
                </Badge>
                {holiday.category && (
                  <Badge variant="secondary" className="text-xs">
                    {holiday.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {hasAnyContent && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <CaptionMedium className="text-green-700 text-xs font-medium">
                {contentProgress} Ready
              </CaptionMedium>
            </div>
          )}
        </div>
      </AppleCardHeader>

      <AppleCardContent className="space-y-4">
        {/* Description */}
        {(holiday.description || holiday.garden_relevance) && (
          <div className="space-y-2">
            <BodyMedium className="text-gray-700 text-sm leading-relaxed">
              {holiday.garden_relevance || holiday.description}
            </BodyMedium>
          </div>
        )}

        {/* Content Types Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <CaptionMedium className="text-gray-600 font-medium">
              5-Piece Content Pack
            </CaptionMedium>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {contentIcons.map(({ icon: Icon, label, color }, index) => (
              <div 
                key={label}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <CaptionMedium className="text-xs text-gray-600 text-center">
                  {label}
                </CaptionMedium>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {hasAnyContent ? (
            <Button
              onClick={() => onViewContent(holiday.id, holiday.holiday_name)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Your Content
            </Button>
          ) : (
            <Button
              onClick={() => onGenerateContent(holiday.id)}
              disabled={isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Pack
                </>
              )}
            </Button>
          )}
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
