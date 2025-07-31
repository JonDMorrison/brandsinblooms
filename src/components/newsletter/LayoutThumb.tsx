import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { NewsletterTemplate } from '@/types/newsletter';
import { cn } from '@/lib/utils';

interface LayoutThumbProps {
  template: NewsletterTemplate;
  isSelected: boolean;
  onSelect: (template: NewsletterTemplate) => void;
  className?: string;
}

export const LayoutThumb: React.FC<LayoutThumbProps> = ({ 
  template, 
  isSelected, 
  onSelect, 
  className 
}) => {
  return (
    <Card 
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50",
        className
      )}
      onClick={() => onSelect(template)}
    >
      <CardContent className="p-4">
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center z-10">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        {/* Layout thumbnail */}
        <div className="aspect-[4/5] bg-gradient-to-b from-muted to-background border rounded-md mb-3 relative overflow-hidden">
          <img 
            src={template.thumbnail} 
            alt={template.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to pattern-based preview if image fails
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = getLayoutPattern(template.layout);
              }
            }}
          />
        </div>

        {/* Template info */}
        <div className="text-center">
          <h4 className="font-medium text-sm mb-1">{template.name}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </p>
          {template.isDefault && (
            <div className="mt-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                Recommended
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Fallback layout patterns when thumbnails fail to load
const getLayoutPattern = (layout: NewsletterTemplate['layout']): string => {
  const patterns = {
    classic: `
      <div class="p-2 space-y-2">
        <div class="h-3 bg-gray-300 rounded w-3/4 mx-auto"></div>
        <div class="h-2 bg-gray-200 rounded w-full"></div>
        <div class="h-2 bg-gray-200 rounded w-5/6"></div>
        <div class="h-8 bg-gray-300 rounded mt-3"></div>
        <div class="h-2 bg-gray-200 rounded w-full"></div>
        <div class="h-2 bg-gray-200 rounded w-4/5"></div>
      </div>
    `,
    magazine: `
      <div class="p-2 grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <div class="h-2 bg-gray-300 rounded"></div>
          <div class="h-1 bg-gray-200 rounded w-3/4"></div>
        </div>
        <div class="h-8 bg-gray-300 rounded"></div>
        <div class="col-span-2 h-2 bg-gray-200 rounded"></div>
      </div>
    `,
    'one-column': `
      <div class="p-2 space-y-2">
        <div class="h-2 bg-gray-300 rounded w-1/2 mx-auto"></div>
        <div class="h-6 bg-gray-300 rounded"></div>
        <div class="h-1 bg-gray-200 rounded"></div>
        <div class="h-1 bg-gray-200 rounded w-5/6"></div>
        <div class="h-6 bg-gray-300 rounded mt-2"></div>
      </div>
    `
  };
  
  return patterns[layout] || patterns.classic;
};