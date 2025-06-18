
import * as React from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HolidayItem } from "./HolidayItem";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, Clock, Sparkles, Leaf } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SeasonalHolidaysCardProps {
  onContentGenerated?: () => void;
  className?: string;
}

export const SeasonalHolidaysCard = ({
  onContentGenerated,
  className
}: SeasonalHolidaysCardProps) => {
  const isMobile = useIsMobile();
  const { holidays, loading, error, generateHolidayContent } = useSeasonalHolidays();
  const [generatingHolidays, setGeneratingHolidays] = React.useState<Set<string>>(new Set());

  const handleGenerateContent = async (holidayId: string) => {
    const holiday = holidays.find(h => h.id === holidayId);
    if (!holiday) return;

    setGeneratingHolidays(prev => new Set(prev).add(holidayId));

    try {
      console.log('Generating content for holiday:', holiday.holiday_name);
      
      const result = await generateHolidayContent(holidayId);
      
      toast.success(`🎉 Generated ${result.tasks?.length || 5} pieces of content for ${holiday.holiday_name}!`, {
        description: "Content is ready for review in your dashboard",
        duration: 5000,
      });

      if (onContentGenerated) {
        onContentGenerated();
      }
    } catch (error) {
      console.error('Failed to generate holiday content:', error);
      toast.error(`Failed to generate content for ${holiday.holiday_name}`, {
        description: error instanceof Error ? error.message : 'Please try again',
        duration: 5000,
      });
    } finally {
      setGeneratingHolidays(prev => {
        const newSet = new Set(prev);
        newSet.delete(holidayId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-80 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse border border-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center py-12 px-6 bg-red-50 rounded-xl border border-red-200">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-red-500" />
          </div>
          <HeadlineMedium className="text-red-800 mb-2">
            Unable to Load Holiday Opportunities
          </HeadlineMedium>
          <BodyMedium className="text-red-600 max-w-md mx-auto">
            {error}
          </BodyMedium>
        </div>
      </div>
    );
  }

  if (holidays.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center py-16 px-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
            <Leaf className="w-10 h-10 text-green-600" />
          </div>
          <HeadlineMedium className="text-gray-800 mb-3">
            No Upcoming Holiday Opportunities
          </HeadlineMedium>
          <BodyMedium className="text-gray-600 max-w-sm mx-auto mb-4">
            No seasonal holidays or observances in the next 90 days. Check back soon for new marketing opportunities!
          </BodyMedium>
          <div className="flex justify-center space-x-2 text-2xl">
            <span className="animate-bounce">🌸</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🌿</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🌱</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Modern Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <HeadlineMedium className="text-gray-900 font-semibold">
            🎯 Seasonal Marketing Opportunities
          </HeadlineMedium>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200">
          <Clock className="w-4 h-4 text-blue-600" />
          <CaptionMedium className="text-blue-700 font-medium">
            {holidays.length} opportunities
          </CaptionMedium>
        </div>
      </div>

      {/* Holiday Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {holidays.map((holiday, index) => (
          <div 
            key={holiday.id}
            className="transform transition-all duration-300 hover:scale-[1.02]"
            style={{ 
              animationDelay: `${index * 100}ms`,
              animation: 'fadeInUp 0.6s ease-out forwards'
            }}
          >
            <HolidayItem
              holiday={holiday}
              onGenerateContent={handleGenerateContent}
              isGenerating={generatingHolidays.has(holiday.id)}
            />
          </div>
        ))}
      </div>

      {/* Bottom CTA Section */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <BodyMedium className="text-gray-800 font-medium mb-1">
              💡 Pro Tip: Generate content early
            </BodyMedium>
            <CaptionMedium className="text-gray-600">
              Create your holiday content 2-3 weeks in advance for best results
            </CaptionMedium>
          </div>
          <div className="text-2xl">🚀</div>
        </div>
      </div>
    </div>
  );
};
