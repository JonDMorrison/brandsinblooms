/**
 * Inline Merge Tag Dropdown
 * 
 * A searchable dropdown for inserting merge tags using central definitions.
 * Supports search filtering and category grouping.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Search, User, ShoppingCart, Star, Settings, Building2 } from 'lucide-react';
import {
  MERGE_TAG_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  formatTagWithDefault,
  searchMergeTags,
  type MergeTagCategory,
  type MergeTagDefinition,
} from '@/lib/mergeTagDefinitions';
import { useMergeTagFavorites } from '@/hooks/useMergeTagFavorites';

interface InlineMergeTagDropdownProps {
  insertText: (text: string) => void;
  excludeCategories?: MergeTagCategory[];
}

const CATEGORY_ICONS: Record<MergeTagCategory, React.ReactNode> = {
  contact: <User className="h-3.5 w-3.5" />,
  purchase: <ShoppingCart className="h-3.5 w-3.5" />,
  loyalty: <Star className="h-3.5 w-3.5" />,
  custom: <Settings className="h-3.5 w-3.5" />,
  company: <Building2 className="h-3.5 w-3.5" />,
  system: <Sparkles className="h-3.5 w-3.5" />,
};

export function InlineMergeTagDropdown({ 
  insertText,
  excludeCategories = [],
}: InlineMergeTagDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addRecentTag } = useMergeTagFavorites();

  // Filter tags based on search and excluded categories
  const filteredTags = useMemo(() => {
    const searched = searchMergeTags(search);
    return searched.filter((tag) => !excludeCategories.includes(tag.category));
  }, [search, excludeCategories]);

  // Group tags by category
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

  // Close on Escape, focus input when opening
  useEffect(() => {
    if (!open) return;

    // Focus search input when dropdown opens
    setTimeout(() => inputRef.current?.focus(), 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleTagSelect = (tag: MergeTagDefinition) => {
    const formattedTag = formatTagWithDefault(tag.key);
    addRecentTag(tag.key);
    insertText(formattedTag);
    setOpen(false);
    setSearch('');
  };

  const filteredCategories = CATEGORY_ORDER.filter(
    (cat) => !excludeCategories.includes(cat) && tagsByCategory[cat].length > 0
  );

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Personalize
      </Button>

      {open && (
        <div
          data-merge-tag-dropdown="true"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Tags List */}
          <div className="max-h-[280px] overflow-y-auto p-1">
            {filteredTags.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No tags found
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category} className="mb-2">
                  {/* Category Header */}
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    <span className={`p-1 rounded ${CATEGORY_COLORS[category].bg}`}>
                      {CATEGORY_ICONS[category]}
                    </span>
                    {CATEGORY_LABELS[category]}
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">
                      {tagsByCategory[category].length}
                    </Badge>
                  </div>
                  
                  {/* Category Tags */}
                  {tagsByCategory[category].map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleTagSelect(tag)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{tag.label}</span>
                        <span className="text-[11px] text-muted-foreground">{tag.description}</span>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] ${CATEGORY_COLORS[category].bg} ${CATEGORY_COLORS[category].text} border-0`}
                      >
                        {tag.example}
                      </Badge>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2">
            <p className="text-[10px] text-muted-foreground text-center">
              Tags include default fallbacks
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InlineMergeTagDropdown;
