
import React, { useState } from 'react';
import { SeasonalHolidaysCard } from './SeasonalHolidaysCard';
import { ThemePreview } from '@/components/content/ThemePreview';
import { GenerationProgress } from '@/components/content/GenerationProgress';
import { FirstTimeUserGuide } from '@/components/content/FirstTimeUserGuide';
import { useUser } from '@/hooks/useUser';

interface EnhancedSeasonalHolidaysCardProps {
  onContentGenerated?: () => void;
}

export const EnhancedSeasonalHolidaysCard = ({ onContentGenerated }: EnhancedSeasonalHolidaysCardProps) => {
  const { isNewUser } = useUser();
  const [showGuide, setShowGuide] = useState(isNewUser);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  const handleThemeSelect = (theme: string) => {
    setSelectedTheme(theme);
  };

  const handleGenerationStart = () => {
    setIsGenerating(true);
    setGenerationStep(0);
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGenerationStep(prev => {
        if (prev >= 4) {
          clearInterval(progressInterval);
          setIsGenerating(false);
          if (onContentGenerated) onContentGenerated();
          return 0;
        }
        return prev + 1;
      });
    }, 6000); // 6 seconds per step
  };

  return (
    <div className="space-y-6">
      {/* First-Time User Guide */}
      {showGuide && (
        <FirstTimeUserGuide 
          onDismiss={() => setShowGuide(false)}
          onStartTour={() => {
            // Could implement a guided tour here
            console.log('Starting guided tour...');
          }}
        />
      )}

      {/* Generation Progress */}
      <GenerationProgress 
        isGenerating={isGenerating}
        currentStep={`Creating content piece ${generationStep + 1} of 5...`}
        totalSteps={5}
        completedSteps={generationStep}
        estimatedTimeRemaining={(5 - generationStep) * 6}
      />

      {/* Theme Preview */}
      {selectedTheme && (
        <ThemePreview 
          theme={selectedTheme}
          description="AI-generated content pack for this seasonal theme"
        />
      )}

      {/* Original Seasonal Holidays Card */}
      <SeasonalHolidaysCard 
        onContentGenerated={() => {
          handleGenerationStart();
          if (onContentGenerated) onContentGenerated();
        }}
      />
    </div>
  );
};
