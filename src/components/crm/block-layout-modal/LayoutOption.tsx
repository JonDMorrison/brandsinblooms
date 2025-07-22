
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LayoutOptionProps {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  preview: React.ReactNode;
  isPopular?: boolean;
  isNew?: boolean;
  onClick: () => void;
}

export const LayoutOption: React.FC<LayoutOptionProps> = ({
  title,
  description,
  category,
  icon,
  preview,
  isPopular,
  isNew,
  onClick
}) => {
  const handleClick = () => {
    console.log('🎯 LayoutOption clicked:', title);
    onClick();
  };

  return (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/30 bg-white"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with icon, title and badges */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-foreground truncate">{title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{description}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 ml-2">
              {isPopular && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-2 py-0.5">
                  Popular
                </Badge>
              )}
              {isNew && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
                  New
                </Badge>
              )}
            </div>
          </div>
          
          {/* Enhanced Preview */}
          <div className="aspect-video bg-gray-50 rounded-lg border-2 border-gray-100 group-hover:border-primary/20 transition-colors overflow-hidden">
            <div className="w-full h-full p-2">
              {preview}
            </div>
          </div>
          
          {/* Category tag */}
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
            <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Click to select
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
