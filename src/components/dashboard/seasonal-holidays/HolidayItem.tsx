import * as React from "react";
import { PremiumButton } from "@/components/ui/premium-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, TrendingUp, Target } from "lucide-react";
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
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Month':
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-purple-500',
          text: 'text-white',
          icon: '📅'
        };
      case 'Week':
        return {
          bg: 'bg-gradient-to-r from-green-500 to-teal-500',
          text: 'text-white',
          icon: '📊'
        };
      case 'Day':
        return {
          bg: 'bg-gradient-to-r from-orange-500 to-red-500',
          text: 'text-white',
          icon: '⭐'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-500 to-gray-600',
          text: 'text-white',
          icon: '📌'
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
        accent: 'from-green-100 to-emerald-100',
        emoji: '🌸'
      };
    } else if (month >= 5 && month <= 7 || lowerName.includes('summer') || lowerName.includes('rose') || lowerName.includes('garden')) {
      return {
        gradient: 'from-yellow-400 via-orange-400 to-red-400',
        accent: 'from-yellow-100 to-orange-100',
        emoji: '☀️'
      };
    } else if (month >= 8 && month <= 10 || lowerName.includes('fall') || lowerName.includes('harvest')) {
      return {
        gradient: 'from-orange-400 via-red-400 to-yellow-400',
        accent: 'from-orange-100 to-red-100',
        emoji: '🍂'
      };
    } else {
      return {
        gradient: 'from-blue-400 via-indigo-400 to-purple-400',
        accent: 'from-blue-100 to-indigo-100',
        emoji: '❄️'
      };
    }
  };

  const getHolidayEmoji = (holidayName: string, date: string) => {
    const lowerName = holidayName.toLowerCase();
    const month = new Date(date).getMonth() + 1; // 1-based month
    
    // Comprehensive emoji mapping with partial matching
    const emojiMap: { [key: string]: string } = {
      // Nature & Environment
      'earth': '🌍', 'arbor': '🌳', 'tree': '🌲', 'forest': '🌲',
      'bee': '🐝', 'butterfly': '🦋', 'bird': '🐦', 'wildlife': '🦌',
      'ocean': '🌊', 'water': '💧', 'river': '🏞️', 'wetland': '🦢',
      'recycling': '♻️', 'environment': '🌱', 'conservation': '🌿',
      
      // Flowers & Plants
      'rose': '🌹', 'flower': '🌸', 'bloom': '🌺', 'blossom': '🌼',
      'tulip': '🌷', 'sunflower': '🌻', 'lily': '🌺', 'daisy': '🌼',
      'garden': '🌱', 'plant': '🪴', 'herb': '🌿', 'seed': '🌱',
      'indoor plant': '🪴', 'houseplant': '🪴', 'succulent': '🌵',
      
      // Seasons & Weather
      'spring': '🌸', 'summer': '☀️', 'fall': '🍂', 'autumn': '🍁',
      'winter': '❄️', 'rain': '🌧️', 'snow': '⛄', 'sun': '☀️',
      
      // Holidays & Celebrations
      'valentine': '💝', 'love': '💕', 'heart': '❤️',
      'mother': '💐', 'mom': '👩', 'father': '🌿', 'dad': '👨',
      'christmas': '🎄', 'holiday': '🎁', 'thanksgiving': '🦃',
      'halloween': '🎃', 'pumpkin': '🎃', 'easter': '🐰',
      'new year': '🎊', 'celebration': '🎉', 'party': '🎈',
      
      // Food & Nutrition
      'nutrition': '🥗', 'healthy': '🍎', 'fruit': '🍓', 'vegetable': '🥕',
      'harvest': '🌾', 'farming': '🚜', 'agriculture': '🌾',
      'cooking': '👩‍🍳', 'recipe': '📖', 'food': '🍽️',
      
      // Education & Awareness
      'awareness': '💡', 'education': '📚', 'learning': '🎓',
      'science': '🔬', 'research': '🧪', 'discovery': '🔍',
      'health': '🏥', 'fitness': '💪', 'wellness': '🧘',
      
      // Activities & Hobbies
      'photography': '📷', 'art': '🎨', 'craft': '✂️', 'diy': '🔨',
      'reading': '📖', 'book': '📚', 'writing': '✍️',
      'music': '🎵', 'dance': '💃', 'sport': '⚽',
      
      // Months (as backup)
      'january': '❄️', 'february': '💝', 'march': '🌸', 'april': '🌷',
      'may': '🌺', 'june': '☀️', 'july': '🌻', 'august': '🌽',
      'september': '🍂', 'october': '🎃', 'november': '🦃', 'december': '🎄'
    };
    
    // Check for partial matches in holiday name
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      if (lowerName.includes(keyword)) {
        return emoji;
      }
    }
    
    // Seasonal fallbacks based on month
    if (month >= 3 && month <= 5) return '🌸'; // Spring
    if (month >= 6 && month <= 8) return '☀️'; // Summer  
    if (month >= 9 && month <= 11) return '🍂'; // Fall
    if (month === 12 || month <= 2) return '❄️'; // Winter
    
    // Category-based fallbacks
    const categoryInfo = getCategoryColor(holiday.category);
    if (categoryInfo.icon === '📅') return '📅'; // Month
    if (categoryInfo.icon === '📊') return '📊'; // Week
    if (categoryInfo.icon === '⭐') return '⭐'; // Day
    
    // Final fallback - but make it more interesting than just target
    return '🎯';
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

  const handleGenerateClick = async () => {
    try {
      await onGenerateContent(holiday.id);
    } catch (error) {
      console.error('Error generating content:', error);
    }
  };

  const categoryInfo = getCategoryColor(holiday.category);
  const seasonalTheme = getSeasonalTheme(holiday.holiday_name, holiday.holiday_date);
  const holidayEmoji = getHolidayEmoji(holiday.holiday_name, holiday.holiday_date);
  const dateInfo = formatDate(holiday.holiday_date);
  const daysUntil = getDaysUntil(holiday.holiday_date);

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300',
      'hover:shadow-xl hover:border-gray-300 hover:-translate-y-1',
      isGenerating && 'opacity-75 pointer-events-none',
      className
    )}>
      {/* Gradient Background Header */}
      <div className={cn(
        'h-3 bg-gradient-to-r',
        seasonalTheme.gradient
      )} />
      
      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Calendar Date Block */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center min-w-[64px]">
              <div className="text-xs font-medium text-gray-500 uppercase">
                {dateInfo.month}
              </div>
              <div className="text-xl font-bold text-gray-800">
                {dateInfo.day}
              </div>
            </div>
            
            {/* Holiday Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{holidayEmoji}</span>
                <HeadlineMedium className="text-gray-900 font-semibold line-clamp-1">
                  {holiday.holiday_name}
                </HeadlineMedium>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className={cn(
                  'text-xs font-medium px-2 py-1 rounded-full',
                  categoryInfo.bg,
                  categoryInfo.text
                )}>
                  <span className="mr-1">{categoryInfo.icon}</span>
                  {holiday.category}
                </Badge>
                
                <CaptionMedium className="text-gray-500 font-medium">
                  {daysUntil === 'Past' ? 'Past' : `In ${daysUntil}`}
                </CaptionMedium>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <BodyMedium className="text-gray-700 mb-4 line-clamp-2">
          {holiday.description}
        </BodyMedium>

        {/* Garden Center Opportunity */}
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
                🎯 Marketing Opportunity
              </CaptionMedium>
              <CaptionMedium className="text-gray-700 leading-relaxed">
                {holiday.garden_relevance}
              </CaptionMedium>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <PremiumButton
            variant="primary"
            size="sm"
            leadingIcon="sparkles"
            premium={true}
            disabled={isGenerating}
            onClick={handleGenerateClick}
            className={cn(
              'px-6 py-2.5 font-medium text-sm rounded-xl shadow-md',
              'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600',
              'transform transition-all duration-200 hover:scale-105 hover:shadow-lg',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
            )}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </PremiumButton>
        </div>
      </div>

      {/* Hover Effect Overlay */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none',
        seasonalTheme.gradient
      )} />
    </div>
  );
};
