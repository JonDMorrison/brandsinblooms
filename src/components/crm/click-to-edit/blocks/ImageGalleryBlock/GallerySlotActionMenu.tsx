import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Wand2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GallerySlotActionMenuProps {
  onAutoPickImage: () => void;
  onOpenMediaSelector: () => void;
  onOpenAIDialog: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export const GallerySlotActionMenu: React.FC<GallerySlotActionMenuProps> = ({
  onAutoPickImage,
  onOpenMediaSelector,
  onOpenAIDialog,
  disabled = false,
  isGenerating = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 150);
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!isExpanded) {
      e.stopPropagation();
      setIsExpanded(true);
    }
  }, [isExpanded]);

  return (
    <div
      className={cn(
        "flex items-center rounded-md overflow-hidden",
        "transition-all duration-300 ease-out",
        isExpanded 
          ? "gap-0.5 bg-background/90 backdrop-blur-sm px-1 py-0.5 shadow-sm" 
          : "gap-0 bg-background/80 backdrop-blur-sm rounded-md shadow-sm"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      role="group"
      aria-label="Image actions"
      aria-expanded={isExpanded}
    >
      {/* Auto Pick Button - slides in from left */}
      <div
        className={cn(
          "transition-all duration-200 ease-out overflow-hidden",
          isExpanded 
            ? "w-6 opacity-100" 
            : "w-0 opacity-0"
        )}
        style={{ transitionDelay: isExpanded ? '0ms' : '100ms' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { 
            e.stopPropagation(); 
            onAutoPickImage();
            setIsExpanded(false);
          }}
          className={cn(
            "h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground",
            "transform transition-transform duration-200",
            isExpanded ? "scale-100" : "scale-75"
          )}
          title="Auto Pick - Generate AI image"
          disabled={disabled || isGenerating}
        >
          <Wand2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Primary Edit Image Button - always visible */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { 
          e.stopPropagation(); 
          onOpenMediaSelector();
        }}
        className={cn(
          "h-6 w-6 p-0 hover:bg-muted shrink-0",
          "transition-all duration-200"
        )}
        title="Browse Images"
        disabled={disabled || isGenerating}
      >
        <Image className="w-3 h-3" />
      </Button>

      {/* AI Assistant Button - slides in from right */}
      <div
        className={cn(
          "transition-all duration-200 ease-out overflow-hidden",
          isExpanded 
            ? "w-6 opacity-100" 
            : "w-0 opacity-0"
        )}
        style={{ transitionDelay: isExpanded ? '100ms' : '0ms' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { 
            e.stopPropagation(); 
            onOpenAIDialog();
            setIsExpanded(false);
          }}
          className={cn(
            "h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground",
            "transform transition-transform duration-200",
            isExpanded ? "scale-100" : "scale-75"
          )}
          title="AI Image Assistant"
          disabled={disabled || isGenerating}
        >
          <Sparkles className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
