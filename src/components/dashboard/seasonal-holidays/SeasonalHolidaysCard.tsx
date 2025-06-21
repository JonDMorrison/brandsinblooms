
import * as React from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HolidayItem } from "./HolidayItem";
import { HolidayContentViewer } from "./HolidayContentViewer";
import { CompanyProfileSetup } from "@/components/onboarding/CompanyProfileSetup";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Sparkles, Leaf, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SeasonalHolidaysCardProps {
  onContentGenerated?: () => void;
  className?: string;
}

export const SeasonalHolidaysCard = ({
  onContentGenerated,
  className
}: SeasonalHolidaysCardProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { allHolidays, holidayContentState, loading, error, generateHolidayContent, refreshHolidayContent } = useSeasonalHolidays();
  const [generatingHolidays, setGeneratingHolidays] = React.useState<Set<string>>(new Set());
  const [showProfileSetup, setShowProfileSetup] = React.useState(false);
  const [hasCompanyProfile, setHasCompanyProfile] = React.useState<boolean | null>(null);
  const [displayLimit, setDisplayLimit] = React.useState(6);
  const [contentViewerState, setContentViewerState] = React.useState<{
    isOpen: boolean;
    holidayId: string | null;
    holidayName: string;
  }>({
    isOpen: false,
    holidayId: null,
    holidayName: ''
  });

  // Get the holidays to display based on the current limit
  const displayedHolidays = React.useMemo(() => {
    return allHolidays.slice(0, displayLimit);
  }, [allHolidays, displayLimit]);

  // Calculate if there are more holidays to show
  const hasMoreHolidays = allHolidays.length > displayLimit;
  const remainingCount = allHolidays.length - displayLimit;

  // Handle load more
  const handleLoadMore = () => {
    setDisplayLimit(prev => Math.min(prev + 6, allHolidays.length));
  };

  // Check if user has company profile
  React.useEffect(() => {
    const checkCompanyProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('id, company_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking company profile:', error);
          setHasCompanyProfile(false);
        } else {
          setHasCompanyProfile(!!profile);
          console.log('Company profile status:', !!profile, profile?.company_name || 'No name');
        }
      } catch (error) {
        console.error('Exception checking company profile:', error);
        setHasCompanyProfile(false);
      }
    };

    checkCompanyProfile();
  }, [user]);

  const handleGenerateContent = async (holidayId: string) => {
    // Check if user has company profile before generating
    if (hasCompanyProfile === false) {
      setShowProfileSetup(true);
      return;
    }

    const holiday = allHolidays.find(h => h.id === holidayId);
    if (!holiday) return;

    setGeneratingHolidays(prev => new Set(prev).add(holidayId));

    try {
      console.log('Generating content for holiday:', holiday.holiday_name);
      
      const result = await generateHolidayContent(holidayId);
      
      // Success toast is handled in the hook
      // Refresh content state to show the new content
      await refreshHolidayContent();

      if (onContentGenerated) {
        onContentGenerated();
      }
    } catch (error) {
      console.error('Failed to generate holiday content:', error);
      // Error toast is handled in the hook
    } finally {
      setGeneratingHolidays(prev => {
        const newSet = new Set(prev);
        newSet.delete(holidayId);
        return newSet;
      });
    }
  };

  const handleViewContent = (holidayId: string, holidayName: string) => {
    const contentState = holidayContentState[holidayId];
    if (!contentState || contentState.contentCount === 0) {
      toast.error('No content available for this holiday');
      return;
    }
    
    setContentViewerState({
      isOpen: true,
      holidayId,
      holidayName
    });
  };

  const handleContentViewerClose = () => {
    setContentViewerState({
      isOpen: false,
      holidayId: null,
      holidayName: ''
    });
    
    // Refresh content state when viewer closes
    refreshHolidayContent();
  };

  const handleProfileSetupComplete = () => {
    setShowProfileSetup(false);
    setHasCompanyProfile(true);
  };

  // Show profile setup modal if needed
  if (showProfileSetup) {
    return (
      <div className={cn('space-y-6', className)}>
        <CompanyProfileSetup onComplete={handleProfileSetupComplete} />
      </div>
    );
  }

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
          <HeadlineLarge className="text-red-800 mb-2">
            Unable to Load Holiday Opportunities
          </HeadlineLarge>
          <BodyMedium className="text-red-600 max-w-md mx-auto">
            {error}
          </BodyMedium>
        </div>
      </div>
    );
  }

  if (allHolidays.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center py-16 px-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
            <Leaf className="w-10 h-10 text-green-600" />
          </div>
          <HeadlineLarge className="text-gray-800 mb-3">
            No Upcoming Holiday Opportunities
          </HeadlineLarge>
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
    <>
      <div className={cn('space-y-6', className)}>
        {/* Modern Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Header content if needed */}
          </div>
        </div>

        {/* Holiday Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayedHolidays.map((holiday, index) => (
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
                onViewContent={handleViewContent}
                isGenerating={generatingHolidays.has(holiday.id)}
                contentState={holidayContentState[holiday.id]}
              />
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMoreHolidays && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Load More ({remainingCount} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Holiday Content Viewer Modal */}
      {contentViewerState.isOpen && contentViewerState.holidayId && (
        <HolidayContentViewer
          holidayId={contentViewerState.holidayId}
          holidayName={contentViewerState.holidayName}
          isOpen={contentViewerState.isOpen}
          onClose={handleContentViewerClose}
          onTaskUpdate={refreshHolidayContent}
        />
      )}
    </>
  );
};
