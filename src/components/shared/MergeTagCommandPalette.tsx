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
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
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
      <CommandInput
        placeholder="Search merge tags..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No merge tags found.</CommandEmpty>
        
        {/* Recent Tags Section */}
        {recentTagDefinitions.length > 0 && (
          <>
            <CommandGroup heading={
              <span className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Recently Used
              </span>
            }>
              {recentTagDefinitions.map((tag) => (
                <CommandItem
                  key={`recent-${tag.key}`}
                  value={`recent-${tag.key}`}
                  onSelect={() => handleSelectTag(tag)}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={`p-1.5 rounded ${CATEGORY_COLORS[tag.category].bg}`}>
                      {CATEGORY_ICONS[tag.category]}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">{tag.label}</span>
                      <span className="text-xs text-muted-foreground">{tag.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {tag.example}
                    </Badge>
                    <button
                      onClick={(e) => handleToggleFavorite(e, tag.key)}
                      className="p-1 hover:bg-accent rounded"
                    >
                      <Heart 
                        className={`h-3.5 w-3.5 ${isFavorite(tag.key) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                      />
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Category Groups */}
        {filteredCategories.map((category) => (
          <CommandGroup
            key={category}
            heading={
              <span className="flex items-center gap-2">
                {CATEGORY_ICONS[category]}
                {CATEGORY_LABELS[category]}
                <Badge variant="outline" className="ml-auto text-xs">
                  {tagsByCategory[category].length}
                </Badge>
              </span>
            }
          >
            {tagsByCategory[category].map((tag) => (
              <CommandItem
                key={tag.key}
                value={tag.key}
                onSelect={() => handleSelectTag(tag)}
                className="flex items-center justify-between py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{tag.label}</span>
                  <span className="text-xs text-muted-foreground">{tag.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
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
                    className="p-1 hover:bg-accent rounded"
                  >
                    <Heart 
                      className={`h-3.5 w-3.5 ${isFavorite(tag.key) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                    />
                  </button>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        
        <CommandSeparator />
        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd> to insert • 
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] ml-1">Esc</kbd> to close
        </div>
      </CommandList>
    </CommandDialog>
  );
}

export default MergeTagCommandPalette;
