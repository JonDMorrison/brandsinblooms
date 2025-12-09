import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Wand2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditMode } from '@/hooks/useBlockEditMode';
import { ContentBlock } from '@/types/emailBuilder';

interface ImageActionMenuProps {
  block: ContentBlock;
  editMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  onAutoPickImage: () => void;
  onOpenAIImageDialog?: () => void;
  disabled?: boolean;
}

export const ImageActionMenu: React.FC<ImageActionMenuProps> = ({
  block,
  editMode,
  onModeChange,
  onAutoPickImage,
  onOpenAIImageDialog,
  disabled = false
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

  // Handle click for mobile touch support
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only toggle on container click if not already expanded
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
          ? "gap-0.5 bg-muted/60 px-0.5" 
          : "gap-0"
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
            ? "w-7 opacity-100" 
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
            "h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground",
            "transform transition-transform duration-200",
            isExpanded ? "scale-100" : "scale-75"
          )}
          title="Auto Pick - Generate AI image"
          disabled={disabled || block.isGeneratingImage}
        >
          <Wand2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Primary Edit Image Button - always visible */}
      <Button
        variant={editMode === 'image' ? 'default' : 'ghost'}
        size="sm"
        onClick={(e) => { 
          e.stopPropagation(); 
          onModeChange(editMode === 'image' ? null : 'image');
        }}
        className={cn(
          "h-7 w-7 p-0 hover:bg-muted shrink-0",
          "transition-all duration-200"
        )}
        title="Edit Image"
      >
        <Image className="w-3 h-3" />
      </Button>

      {/* AI Assistant Button - slides in from right */}
      {onOpenAIImageDialog && (
        <div
          className={cn(
            "transition-all duration-200 ease-out overflow-hidden",
            isExpanded 
              ? "w-7 opacity-100" 
              : "w-0 opacity-0"
          )}
          style={{ transitionDelay: isExpanded ? '100ms' : '0ms' }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { 
              e.stopPropagation(); 
              onOpenAIImageDialog();
              setIsExpanded(false);
            }}
            className={cn(
              "h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground",
              "transform transition-transform duration-200",
              isExpanded ? "scale-100" : "scale-75"
            )}
            title="AI Image Assistant"
          >
            <Sparkles className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
