/**
 * Merge Tag Picker Component
 * 
 * A dropdown UI for selecting and inserting merge tags into email/SMS content.
 * Uses DropdownMenu with subcategories for better portal/focus handling.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  ShoppingCart,
  Star,
  Settings,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
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

  const tagsByCategory = useMemo(() => getMergeTagsByCategory(), []);

  const filteredCategories = useMemo(() => {
    return CATEGORY_ORDER.filter(cat => !excludeCategories.includes(cat));
  }, [excludeCategories]);

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
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        {variant === 'button' ? (
          <Button
            variant="outline"
            size={size}
            className={className}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            Personalize
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={className}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64"
        align="start"
        side="bottom"
        data-merge-tag-picker="true"
        data-click-to-edit-allowed-overlay="true"
      >
        {filteredCategories.map((category, index) => (
          <React.Fragment key={category}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                {CATEGORY_ICONS[category]}
                <span>{CATEGORY_LABELS[category]}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {tagsByCategory[category].length}
                </Badge>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent 
                className="w-64 max-h-[300px] overflow-y-auto"
                data-merge-tag-picker="true"
                data-click-to-edit-allowed-overlay="true"
              >
                {tagsByCategory[category].map((tag) => (
                  <DropdownMenuItem
                    key={tag.key}
                    onClick={() => handleSelectTag(tag)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm">{tag.label}</span>
                      <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                        {`{{ ${tag.key} }}`}
                      </code>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tag.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </React.Fragment>
        ))}
        
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground text-center">
            Tags include default fallbacks
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MergeTagPicker;
