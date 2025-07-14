import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { FocusCard } from './FocusCard';
import { FocusFilterSheet } from './FocusFilterSheet';
import { useFocusThemes } from '@/hooks/useFocusThemes';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

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

  const createCampaignFromTheme = async (theme: any) => {
    console.log('🏗️ Creating campaign from theme:', theme);
    
    const campaignData = {
      title: theme.title,
      theme: theme.title,
      description: theme.description,
      user_id: user?.id,
      tenant_id: tenant?.id,
      week_number: 1,
      start_date: new Date().toISOString().split('T')[0],
      source: 'focus_theme'
    };

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }

    console.log('✅ Created campaign:', campaign);
    return campaign;
  };

  const handleGenerate = async (themeId: string) => {
    if (!user) {
      
      return;
    }

    console.log('🎯 FocusCarousel: Starting generation for theme:', themeId);
    setGeneratingTheme(themeId);
    
    try {
      const theme = themes.find(t => t.id === themeId);
      if (!theme) {
        throw new Error('Theme not found');
      }

      console.log('📝 Step 1: Creating campaign from theme');
      // Step 1: Create a real campaign from the theme
      const campaign = await createCampaignFromTheme(theme);

      console.log('🤖 Step 2: Generating content for campaign:', campaign.id);
      // Step 2: Generate content using the real campaign ID
      const result = await generateCampaignContent(
        campaign.id, // Use the real campaign ID
        theme.title,
        theme.description,
        user.id,
        1, // week number
        tenant?.id
      );

      if (result.success) {
        console.log('✅ Content generation successful:', result);
        
        // Step 3: Mark theme as generated
        await markGenerated(themeId);
        
        // Step 4: Show success toast
        const taskCount = result.tasks?.length || 5;

        // Step 5: Refresh the dashboard to show new drafts
        if (onTaskUpdate) {
          console.log('🔄 Refreshing dashboard data');
          onTaskUpdate();
        }

        // Move to next theme if available
        if (currentIndex < themes.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        console.error('❌ Content generation failed:', result);
        
      }
    } catch (error) {
      console.error('❌ Error in handleGenerate:', error);
      
    } finally {
      setGeneratingTheme(null);
    }
  };

  const handleSkip = async (themeId: string) => {
    await skipTheme(themeId);
    
    
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
