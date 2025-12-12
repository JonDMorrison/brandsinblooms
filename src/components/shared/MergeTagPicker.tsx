/**
 * Merge Tag Picker Component
 * 
 * A dropdown UI for selecting and inserting merge tags into email/SMS content.
 * Supports categories, search, and inserts tags with appropriate defaults.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  User,
  ShoppingCart,
  Star,
  Settings,
  Building2,
  Sparkles,
  Search,
  ChevronRight,
} from 'lucide-react';
import {
  MERGE_TAG_DEFINITIONS,
  getMergeTagsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatTagWithDefault,
  type MergeTagCategory,
  type MergeTagDefinition,
} from '@/lib/mergeTagDefinitions';
import { registerEditOverlay, unregisterEditOverlay } from '@/components/crm/click-to-edit/editOverlayRegistry';

interface MergeTagPickerProps {
  onSelectTag: (tag: string) => void;
  variant?: 'button' | 'icon';
  size?: 'sm' | 'default';
  excludeCategories?: MergeTagCategory[];
  className?: string;
}

const CATEGORY_ICONS: Record<MergeTagCategory, React.ReactNode> = {
  contact: <User className="h-4 w-4" />,
  purchase: <ShoppingCart className="h-4 w-4" />,
  loyalty: <Star className="h-4 w-4" />,
  custom: <Settings className="h-4 w-4" />,
  company: <Building2 className="h-4 w-4" />,
  system: <Sparkles className="h-4 w-4" />,
};

export function MergeTagPicker({
  onSelectTag,
  variant = 'button',
  size = 'default',
  excludeCategories = [],
  className,
}: MergeTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<MergeTagCategory | null>(null);

  const tagsByCategory = useMemo(() => getMergeTagsByCategory(), []);

  const filteredCategories = useMemo(() => {
    return CATEGORY_ORDER.filter(cat => !excludeCategories.includes(cat));
  }, [excludeCategories]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return null;

    const searchLower = search.toLowerCase();
    return MERGE_TAG_DEFINITIONS.filter(
      tag =>
        !excludeCategories.includes(tag.category) &&
        (tag.label.toLowerCase().includes(searchLower) ||
          tag.key.toLowerCase().includes(searchLower) ||
          tag.description.toLowerCase().includes(searchLower))
    );
  }, [search, excludeCategories]);

  // Register/unregister overlay on open state change
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      registerEditOverlay('merge-tag-picker');
    } else {
      unregisterEditOverlay('merge-tag-picker');
    }
  };

  // Cleanup on unmount to prevent stuck overlay state
  useEffect(() => {
    return () => {
      unregisterEditOverlay('merge-tag-picker');
    };
  }, []);

  const handleSelectTag = (tag: MergeTagDefinition) => {
    const formattedTag = formatTagWithDefault(tag.key);
    onSelectTag(formattedTag);
    setOpen(false);
    setSearch('');
    setExpandedCategory(null);
  };

  const toggleCategory = (category: MergeTagCategory) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === 'button' ? (
          <Button
            variant="outline"
            size={size}
            className={className}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenChange(true);
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            Personalize
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={className}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenChange(true);
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="bottom"
        onPointerDownOutside={(e) => e.preventDefault()}
        data-merge-tag-picker="true"
        data-click-to-edit-allowed-overlay="true"
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search merge tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          {filteredTags ? (
            // Search results view
            <div className="p-2">
              {filteredTags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tags found for "{search}"
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredTags.map((tag) => (
                    <TagItem
                      key={tag.key}
                      tag={tag}
                      onClick={() => handleSelectTag(tag)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Category view
            <div className="p-2">
              {filteredCategories.map((category) => (
                <div key={category} className="mb-1">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[category]}
                      <span className="text-sm font-medium">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {tagsByCategory[category].length}
                      </Badge>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedCategory === category ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {expandedCategory === category && (
                    <div className="ml-6 mt-1 space-y-1">
                      {tagsByCategory[category].map((tag) => (
                        <TagItem
                          key={tag.key}
                          tag={tag}
                          onClick={() => handleSelectTag(tag)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            Tags include default fallbacks when data is missing
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TagItemProps {
  tag: MergeTagDefinition;
  onClick: () => void;
}

function TagItem({ tag, onClick }: TagItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{tag.label}</span>
        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          {`{{ ${tag.key} }}`}
        </code>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {tag.description}
      </p>
      {tag.defaultFallback && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Default: "{tag.defaultFallback}"
        </p>
      )}
    </button>
  );
}

export default MergeTagPicker;
