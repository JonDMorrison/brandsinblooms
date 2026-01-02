/**
 * Merge Tag Quick Bar
 * 
 * A horizontal toolbar with quick-access chips for common merge tags.
 * Supports customization via favorites and shows most-used tags.
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronRight } from 'lucide-react';
import {
  getMergeTagByKey,
  formatTagWithDefault,
  DEFAULT_QUICK_ACCESS_TAGS,
  CATEGORY_COLORS,
  type MergeTagCategory,
  type MergeTagDefinition,
} from '@/lib/mergeTagDefinitions';
import { useMergeTagFavorites } from '@/hooks/useMergeTagFavorites';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MergeTagQuickBarProps {
  onSelectTag: (tag: string) => void;
  onOpenPalette?: () => void;
  excludeCategories?: MergeTagCategory[];
  className?: string;
  maxTags?: number;
}

export function MergeTagQuickBar({
  onSelectTag,
  onOpenPalette,
  excludeCategories = [],
  className,
  maxTags = 5,
}: MergeTagQuickBarProps) {
  const { getQuickAccessTags, addRecentTag } = useMergeTagFavorites();

  // Get tags to display: favorites/recent first, then defaults
  const displayTags = useMemo(() => {
    const quickTags = getQuickAccessTags();
    const tagKeys = quickTags.length > 0 ? quickTags : DEFAULT_QUICK_ACCESS_TAGS;
    
    return tagKeys
      .map((key) => getMergeTagByKey(key))
      .filter((tag): tag is MergeTagDefinition => 
        tag !== undefined && !excludeCategories.includes(tag.category)
      )
      .slice(0, maxTags);
  }, [getQuickAccessTags, excludeCategories, maxTags]);

  const handleSelectTag = (tag: MergeTagDefinition) => {
    const formattedTag = formatTagWithDefault(tag.key);
    addRecentTag(tag.key);
    onSelectTag(formattedTag);
  };

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        "flex items-center gap-1.5 flex-wrap",
        className
      )}>
        <span className="text-xs text-muted-foreground mr-1 shrink-0">
          Quick insert:
        </span>
        
        {displayTags.map((tag) => (
          <Tooltip key={tag.key}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs font-medium transition-colors",
                  CATEGORY_COLORS[tag.category].bg,
                  CATEGORY_COLORS[tag.category].text,
                  "border",
                  CATEGORY_COLORS[tag.category].border,
                  "hover:opacity-80"
                )}
                onClick={() => handleSelectTag(tag)}
              >
                {tag.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <div className="text-xs">
                <p className="font-medium">{tag.description}</p>
                <p className="text-muted-foreground mt-1">
                  Example: <span className="font-mono">{tag.example}</span>
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {onOpenPalette && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onOpenPalette}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            More
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

export default MergeTagQuickBar;
