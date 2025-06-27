
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { FocusCard } from './FocusCard';
import { FocusFilterSheet } from './FocusFilterSheet';
import { useFocusThemes } from '@/hooks/useFocusThemes';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface FocusCarouselProps {
  onTaskUpdate?: () => void;
}

export const FocusCarousel = ({ onTaskUpdate }: FocusCarouselProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { themes, filters, loading, updateFilters, skipTheme, markGenerated } = useFocusThemes();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : themes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < themes.length - 1 ? prev + 1 : 0));
  };

  const handleGenerate = async (themeId: string) => {
    if (!user) return;

    setGeneratingTheme(themeId);
    try {
      const theme = themes.find(t => t.id === themeId);
      if (!theme) return;

      // Generate content using the existing service
      const result = await generateCampaignContent(
        themeId, // Using theme ID as campaign ID
        theme.title,
        theme.description,
        user.id,
        1, // week number
        tenant?.id
      );

      if (result.success) {
        // Mark theme as generated
        await markGenerated(themeId);
        
        // Show success toast
        toast.success(`Added ${result.tasks?.length || 5} drafts • Open Draft Tray`, {
          duration: 5000,
          action: {
            label: 'View Drafts',
            onClick: () => {
              // Focus could be added to open draft tray
              if (onTaskUpdate) onTaskUpdate();
            }
          }
        });

        // Call task update to refresh the draft tray
        if (onTaskUpdate) {
          onTaskUpdate();
        }

        // Move to next theme
        if (currentIndex < themes.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        toast.error('Failed to generate content. Please try again.');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setGeneratingTheme(null);
    }
  };

  const handleSkip = async (themeId: string) => {
    await skipTheme(themeId);
    toast.success('Theme skipped • Won\'t show again for one year');
    
    // Move to next theme or stay on current if it was the last one
    if (themes.length > 1) {
      if (currentIndex >= themes.length - 1) {
        setCurrentIndex(0);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[300px] flex items-center justify-center border border-white/20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#68BEB9] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading themes...</p>
        </div>
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[300px] flex flex-col items-center justify-center border border-white/20">
        <h3 className="text-lg font-semibold text-[#3E5A6B] mb-2">No Themes Available</h3>
        <p className="text-gray-600 text-center mb-4">
          All themes have been generated or skipped. Adjust your filters to see more options.
        </p>
        <FocusFilterSheet filters={filters} onFiltersChange={updateFilters} />
      </div>
    );
  }

  const currentTheme = themes[currentIndex];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 overflow-hidden">
      {/* Header with filter */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Today's Focus</h2>
        <FocusFilterSheet filters={filters} onFiltersChange={updateFilters} />
      </div>

      {/* Carousel Content */}
      <div className="relative h-[400px]">
        {/* Navigation Buttons */}
        {themes.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
              onClick={handlePrevious}
              aria-label="Previous theme"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
              onClick={handleNext}
              aria-label="Next theme"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Current Theme Card */}
        <div className="h-full p-6">
          <FocusCard
            theme={currentTheme}
            onGenerate={handleGenerate}
            onSkip={handleSkip}
            isGenerating={generatingTheme === currentTheme.id}
          />
        </div>
      </div>

      {/* Pagination */}
      {themes.length > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-gray-50/50">
          {/* Dots */}
          <div className="flex items-center gap-1">
            {themes.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                  index === currentIndex ? 'bg-[#68BEB9]' : 'bg-gray-300'
                }`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Slide ${index + 1} of ${themes.length}`}
              />
            ))}
          </div>
          
          {/* Counter */}
          <span className="text-xs text-gray-500">
            {currentIndex + 1} / {themes.length} this week
          </span>
        </div>
      )}
    </div>
  );
};
