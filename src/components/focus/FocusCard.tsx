
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getDynamicIcon } from '../new-dashboard/iconUtils';
import { FocusTheme } from '@/hooks/useFocusThemes';

interface FocusCardProps {
  theme: FocusTheme;
  onGenerate: (themeId: string) => void;
  onSkip: (themeId: string) => void;
  isGenerating?: boolean;
}

export const FocusCard = ({ theme, onGenerate, onSkip, isGenerating }: FocusCardProps) => {
  const { icon: DynamicIcon, color: iconColor } = getDynamicIcon({ title: theme.title });

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
      plant_care: 'bg-green-100 text-green-800',
      decor: 'bg-purple-100 text-purple-800',
      sale: 'bg-orange-100 text-orange-800',
      holidays: 'bg-blue-100 text-blue-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-full flex flex-col items-center justify-center border border-white/20">
      <div className="flex items-center gap-2 mb-4">
        <Badge className={getCategoryColor(theme.category)}>
          {getCategoryLabel(theme.category)}
        </Badge>
      </div>

      {/* Icon */}
      <div className="relative w-20 h-20 mx-auto mb-4">
        <div 
          className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
          style={{ backgroundColor: iconColor }}
        >
          <DynamicIcon className="w-8 h-8 text-white" />
        </div>
      </div>
      
      {/* Theme Title */}
      <h3 className="text-lg font-semibold text-[#3E5A6B] text-center mb-2">
        {theme.title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-gray-600 text-center mb-6 px-2">
        {theme.description}
      </p>
      
      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white font-medium px-6 py-3 rounded-full w-full"
                onClick={() => onGenerate(theme.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>Generate Content • 1 token</>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">{theme.teaser}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button 
          variant="outline"
          className="text-gray-600 border-gray-300 hover:bg-gray-50 font-medium px-6 py-2 rounded-full w-full"
          onClick={() => onSkip(theme.id)}
          disabled={isGenerating}
        >
          Skip
        </Button>
      </div>
    </div>
  );
};
