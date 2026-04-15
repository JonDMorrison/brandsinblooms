/**
 * Merge Tag Command Palette
 * 
 * A modern, searchable command palette for inserting merge tags.
 * Supports keyboard navigation, fuzzy search, and recent tags.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui-legacy/command';
import { Badge } from '@/components/ui-legacy/badge';
import {
  User,
  ShoppingCart,
  Star,
  Settings,
  Building2,
  Sparkles,
  Clock,
  Heart,
} from 'lucide-react';
import {
  MERGE_TAG_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  formatTagWithDefault,
  getMergeTagByKey,
  searchMergeTags,
  type MergeTagCategory,
  type MergeTagDefinition,
} from '@/lib/mergeTagDefinitions';
import { useMergeTagFavorites } from '@/hooks/useMergeTagFavorites';

interface MergeTagCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTag: (tag: string) => void;
  excludeCategories?: MergeTagCategory[];
}

const CATEGORY_ICONS: Record<MergeTagCategory, React.ReactNode> = {
  contact: <User className="h-4 w-4" />,
  purchase: <ShoppingCart className="h-4 w-4" />,
  loyalty: <Star className="h-4 w-4" />,
  custom: <Settings className="h-4 w-4" />,
  company: <Building2 className="h-4 w-4" />,
  system: <Sparkles className="h-4 w-4" />,
};

export function MergeTagCommandPalette({
  open,
  onOpenChange,
  onSelectTag,
  excludeCategories = [],
}: MergeTagCommandPaletteProps) {
  const [search, setSearch] = useState('');
  const { recentTags, addRecentTag, isFavorite, toggleFavorite } = useMergeTagFavorites();

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  // Filter tags based on search and excluded categories
  const filteredTags = useMemo(() => {
    const searched = searchMergeTags(search);
    return searched.filter((tag) => !excludeCategories.includes(tag.category));
  }, [search, excludeCategories]);

  // Group filtered tags by category
  const tagsByCategory = useMemo(() => {
    const grouped: Record<MergeTagCategory, MergeTagDefinition[]> = {
      contact: [],
      purchase: [],
      loyalty: [],
      custom: [],
      company: [],
      system: [],
    };
    
    for (const tag of filteredTags) {
      grouped[tag.category].push(tag);
    }
    
    return grouped;
  }, [filteredTags]);

  // Get recent tags that match search
  const recentTagDefinitions = useMemo(() => {
    if (search) return []; // Hide recent when searching
    
    return recentTags
      .map((key) => getMergeTagByKey(key))
      .filter((tag): tag is MergeTagDefinition => 
        tag !== undefined && !excludeCategories.includes(tag.category)
      )
      .slice(0, 5);
  }, [recentTags, search, excludeCategories]);

  const handleSelectTag = useCallback((tag: MergeTagDefinition) => {
    const formattedTag = formatTagWithDefault(tag.key);
    addRecentTag(tag.key);
    onSelectTag(formattedTag);
    onOpenChange(false);
  }, [addRecentTag, onSelectTag, onOpenChange]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, tagKey: string) => {
    e.stopPropagation();
    toggleFavorite(tagKey);
  }, [toggleFavorite]);

  const filteredCategories = CATEGORY_ORDER.filter(
    (cat) => !excludeCategories.includes(cat) && tagsByCategory[cat].length > 0
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="p-4 pb-2 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <h2 className="text-lg font-semibold text-foreground mb-1">Insert Merge Tag</h2>
        <p className="text-sm text-muted-foreground">Personalize your message with dynamic content</p>
      </div>
      <CommandInput
        placeholder="Search merge tags..."
        value={search}
        onValueChange={setSearch}
        className="border-0 border-b rounded-none focus:ring-0 px-4 h-12"
      />
      <CommandList className="max-h-[400px] p-2">
        <CommandEmpty className="py-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No merge tags found.</p>
          </div>
        </CommandEmpty>
        
        {/* Recent Tags Section */}
        {recentTagDefinitions.length > 0 && (
          <>
            <CommandGroup 
              heading={
                <span className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Recently Used
                </span>
              }
              className="px-1"
            >
              {recentTagDefinitions.map((tag) => (
                <CommandItem
                  key={`recent-${tag.key}`}
                  value={`recent-${tag.key}`}
                  onSelect={() => handleSelectTag(tag)}
                  className="flex items-center justify-between py-3 px-3 rounded-lg mb-1 cursor-pointer data-[selected=true]:bg-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-lg ${CATEGORY_COLORS[tag.category].bg} ${CATEGORY_COLORS[tag.category].text}`}>
                      {CATEGORY_ICONS[tag.category]}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{tag.label}</span>
                      <span className="text-xs text-muted-foreground">{tag.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs font-mono bg-muted/50">
                      {tag.example}
                    </Badge>
                    <button
                      onClick={(e) => handleToggleFavorite(e, tag.key)}
                      className="p-1.5 hover:bg-accent rounded-md transition-colors"
                    >
                      <Heart 
                        className={`h-4 w-4 ${isFavorite(tag.key) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`} 
                      />
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator className="my-2" />
          </>
        )}

        {/* Category Groups */}
        {filteredCategories.map((category) => (
          <CommandGroup
            key={category}
            heading={
              <span className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={`p-1 rounded ${CATEGORY_COLORS[category].bg} ${CATEGORY_COLORS[category].text}`}>
                  {CATEGORY_ICONS[category]}
                </span>
                {CATEGORY_LABELS[category]}
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                  {tagsByCategory[category].length}
                </Badge>
              </span>
            }
            className="px-1"
          >
            {tagsByCategory[category].map((tag) => (
              <CommandItem
                key={tag.key}
                value={tag.key}
                onSelect={() => handleSelectTag(tag)}
                className="flex items-center justify-between py-3 px-3 rounded-lg mb-1 cursor-pointer data-[selected=true]:bg-primary/10"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{tag.label}</span>
                  <span className="text-xs text-muted-foreground">{tag.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="text-[11px] bg-muted/80 px-2 py-1 rounded-md font-mono text-muted-foreground">
                    {`{{ ${tag.key} }}`}
                  </code>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${CATEGORY_COLORS[tag.category].bg} ${CATEGORY_COLORS[tag.category].text} border-0`}
                  >
                    {tag.example}
                  </Badge>
                  <button
                    onClick={(e) => handleToggleFavorite(e, tag.key)}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors"
                  >
                    <Heart 
                      className={`h-4 w-4 ${isFavorite(tag.key) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`} 
                    />
                  </button>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      
      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-background border rounded text-[10px] font-medium shadow-sm">↑↓</kbd>
          <span>Navigate</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-background border rounded text-[10px] font-medium shadow-sm">↵</kbd>
          <span>Insert</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-background border rounded text-[10px] font-medium shadow-sm">Esc</kbd>
          <span>Close</span>
        </span>
      </div>
    </CommandDialog>
  );
}

export default MergeTagCommandPalette;
