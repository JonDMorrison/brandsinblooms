
import * as React from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HolidayItem } from "./HolidayItem";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, Clock, Sparkles } from "lucide-react";
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
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className={cn('animate-pulse', className)}
        hoverEffect="none"
      >
        <AppleCardHeader className="apple-card-spacing">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div>
              <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </AppleCardHeader>
        <AppleCardContent className="apple-card-spacing">
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  if (error) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className={cn('border-red-200', className)}
        hoverEffect="none"
      >
        <AppleCardContent className="apple-card-spacing text-center py-8">
          <div className="text-red-500 mb-2">⚠️</div>
          <HeadlineMedium className="text-red-700 mb-2">
            Failed to Load Holidays
          </HeadlineMedium>
          <BodyMedium className="text-red-600">
            {error}
          </BodyMedium>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  if (holidays.length === 0) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className={cn('apple-empty-state', className)}
        hoverEffect="none"
      >
        <AppleCardContent className={`text-center ${isMobile ? 'py-6' : 'py-8'}`}>
          <div className={`apple-icon-container mx-auto mb-4 ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}`}>
            <Calendar className={`text-gray-400 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
          </div>
          <HeadlineMedium className={`text-gray-600 mb-2 ${isMobile ? 'text-lg' : ''}`}>
            No Upcoming Holidays
          </HeadlineMedium>
          <BodyMedium className={`text-gray-500 max-w-sm mx-auto ${isMobile ? 'text-sm' : ''}`}>
            No seasonal holidays or observances in the next 30 days. Check back soon for new opportunities!
          </BodyMedium>
          <div className="mt-4">
            <span className="text-2xl garden-breathing">🌸</span>
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      surface="primary"
      hoverEffect="subtle"
      animated={true}
      className={cn('border-l-4 border-l-green-400 shadow-lg', className)}
    >
      <AppleCardHeader className={`apple-card-spacing ${isMobile ? 'pb-3' : 'pb-4'}`}>
        <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-4 text-center' : ''}`}>
          <div className={`flex items-center gap-4 ${isMobile ? 'w-full justify-center' : ''}`}>
            <div className={`apple-icon-container apple-spring-bounce ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
              <Sparkles className={`text-green-600 ${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </div>
            <div className={isMobile ? 'text-center' : ''}>
              <HeadlineMedium className={`apple-headline-medium text-gray-800 ${isMobile ? 'text-lg' : ''}`}>
                🎉 Seasonal Holidays & Observances
              </HeadlineMedium>
              <CaptionMedium className={`apple-caption-enhanced text-gray-600 ${isMobile ? 'text-sm' : ''}`}>
                {holidays.length} upcoming holiday{holidays.length !== 1 ? 's' : ''} in the next 30 days
              </CaptionMedium>
            </div>
          </div>
          {!isMobile && (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4" />
              <CaptionMedium>Next 30 days</CaptionMedium>
            </div>
          )}
        </div>
      </AppleCardHeader>

      <AppleCardContent className="apple-card-spacing">
        <ResponsiveGrid 
          cols={{ mobile: 1, tablet: 1, desktop: 2 }}
          gap={{ mobile: "gap-4", tablet: "gap-5", desktop: "gap-6" }}
          animated={true}
          staggerDelay={150}
        >
          {holidays.map((holiday, index) => (
            <div 
              key={holiday.id}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <HolidayItem
                holiday={holiday}
                onGenerateContent={handleGenerateContent}
                isGenerating={generatingHolidays.has(holiday.id)}
              />
            </div>
          ))}
        </ResponsiveGrid>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
