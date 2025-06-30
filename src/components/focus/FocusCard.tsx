
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Clock } from 'lucide-react';
import { getFocusThemeIcon } from './iconMappings';
import { FocusTheme } from '@/hooks/useFocusThemes';

interface FocusCardProps {
  theme: FocusTheme;
  onGenerate: (themeId: string) => void;
  onSkip: (themeId: string) => void;
  isGenerating?: boolean;
}

export const FocusCard = ({ theme, onGenerate, onSkip, isGenerating }: FocusCardProps) => {
  const { icon: DynamicIcon, color: iconColor, gradient } = getFocusThemeIcon(theme);

  const getCategoryLabel = (category: string) => {
    const labels = {
      plant_care: 'Plant Care',
      decor: 'Garden Decor',
      sale: 'Promotions',
      holidays: 'Seasonal'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      plant_care: 'bg-green-100 text-green-800 border-green-200',
      decor: 'bg-purple-100 text-purple-800 border-purple-200',
      sale: 'bg-orange-100 text-orange-800 border-orange-200',
      holidays: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPlanningAheadBadgeColor = () => {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  const getCurrentSeasonBadgeColor = () => {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-full flex flex-col items-center justify-center border border-white/20">
      <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
        <Badge className={`${getCategoryColor(theme.category)} border`}>
          {getCategoryLabel(theme.category)}
        </Badge>
        
        {/* Seasonal Label Badge */}
        {theme.label === 'Planning Ahead' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={`${getPlanningAheadBadgeColor()} border flex items-center gap-1`}>
                  <Calendar className="w-3 h-3" />
                  Planning Ahead
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm max-w-xs">This content is for upcoming weeks - perfect for planning ahead!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {theme.label === 'Current Season' && (
          <Badge className={`${getCurrentSeasonBadgeColor()} border flex items-center gap-1`}>
            <Clock className="w-3 h-3" />
            Perfect Timing
          </Badge>
        )}
      </div>

      {/* Enhanced Icon with solid brand color background */}
      <div className="relative w-20 h-20 mx-auto mb-4">
        <div 
          className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
          style={{ backgroundColor: '#68BEB9' }}
        >
          <DynamicIcon className="w-10 h-10 text-white drop-shadow-sm" />
        </div>
        
        {/* Subtle glow effect using brand color */}
        <div 
          className="absolute inset-0 rounded-full opacity-20 blur-md -z-10"
          style={{ backgroundColor: '#68BEB9' }}
        />
      </div>
      
      {/* Theme Title */}
      <h3 className="text-lg font-semibold text-[#3E5A6B] text-center mb-2">
        {theme.title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-gray-600 text-center mb-6 px-2 leading-relaxed">
        {theme.description}
      </p>
      
      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white font-medium px-6 py-3 rounded-full w-full shadow-md hover:shadow-lg transition-all duration-200"
                onClick={() => onGenerate(theme.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>Generate Content</>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm max-w-xs">{theme.teaser}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
