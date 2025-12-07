import React from 'react';
import { cn } from '@/lib/utils';

export type GalleryLayout = '3-across' | '6-across' | '9-images';

interface GalleryLayoutSelectorProps {
  value: GalleryLayout;
  onChange: (layout: GalleryLayout) => void;
}

const layoutOptions: { value: GalleryLayout; label: string; description: string; grid: number[] }[] = [
  { value: '3-across', label: '3 Images', description: '1 row of 3', grid: [1, 1, 1] },
  { value: '6-across', label: '6 Images', description: '2 rows of 3', grid: [1, 1, 1, 1, 1, 1] },
  { value: '9-images', label: '9 Images', description: '3 rows of 3', grid: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
];

export const GalleryLayoutSelector: React.FC<GalleryLayoutSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex gap-2">
      {layoutOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 p-3 rounded-lg border-2 transition-all",
            "hover:border-primary/50 hover:bg-accent/50",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-border bg-background"
          )}
        >
          {/* Mini grid preview */}
          <div className="flex flex-wrap gap-0.5 justify-center mb-2">
            {option.grid.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-3 h-3 rounded-sm",
                  value === option.value ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <div className="text-xs font-medium text-center">{option.label}</div>
          <div className="text-xs text-muted-foreground text-center">{option.description}</div>
        </button>
      ))}
    </div>
  );
};
