/**
 * Merge Tag Picker Component
 *
 * A dropdown UI for selecting and inserting merge tags into email/SMS content.
 * Uses DropdownMenu with subcategories for better portal/focus handling.
 * Now includes search functionality and category color coding.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui-legacy/dropdown-menu";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Input } from "@/components/ui-legacy/input";
import {
  User,
  ShoppingCart,
  Star,
  Settings,
  Building2,
  Sparkles,
  Search,
} from "lucide-react";
import {
  getMergeTagsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  formatTagWithDefault,
  searchMergeTags,
  type MergeTagCategory,
  type MergeTagDefinition,
} from "@/lib/mergeTagDefinitions";
import {
  registerEditOverlay,
  unregisterEditOverlay,
} from "@/components/shared/editOverlayRegistry";
import { useMergeTagFavorites } from "@/hooks/useMergeTagFavorites";

interface MergeTagPickerProps {
  onSelectTag: (tag: string) => void;
  variant?: "button" | "icon";
  size?: "sm" | "default";
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
  variant = "button",
  size = "default",
  excludeCategories = [],
  className,
}: MergeTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { addRecentTag } = useMergeTagFavorites();

  const tagsByCategory = useMemo(() => getMergeTagsByCategory(), []);

  // Filter by search and excluded categories
  const filteredTags = useMemo(() => {
    const searched = searchMergeTags(search);
    return searched.filter((tag) => !excludeCategories.includes(tag.category));
  }, [search, excludeCategories]);

  const filteredTagsByCategory = useMemo(() => {
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

  const filteredCategories = useMemo(() => {
    return CATEGORY_ORDER.filter(
      (cat) =>
        !excludeCategories.includes(cat) &&
        filteredTagsByCategory[cat].length > 0,
    );
  }, [excludeCategories, filteredTagsByCategory]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      registerEditOverlay("merge-tag-picker");
      setSearch("");
    } else {
      unregisterEditOverlay("merge-tag-picker");
    }
  };

  useEffect(() => {
    return () => {
      unregisterEditOverlay("merge-tag-picker");
    };
  }, []);

  const handleSelectTag = (tag: MergeTagDefinition) => {
    const formattedTag = formatTagWithDefault(tag.key);
    addRecentTag(tag.key);
    onSelectTag(formattedTag);
    setOpen(false);
  };

  return (
    <span
      data-merge-tag-picker-root="true"
      data-click-to-edit-allowed-overlay="true"
      style={{ display: "contents" }}
    >
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          {variant === "button" ? (
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
          className="w-72"
          align="start"
          side="bottom"
          data-merge-tag-picker="true"
          data-click-to-edit-allowed-overlay="true"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {filteredCategories.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No tags found
              </div>
            ) : (
              filteredCategories.map((category, index) => (
                <React.Fragment key={category}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <span
                        className={`p-1 rounded ${CATEGORY_COLORS[category].bg}`}
                      >
                        {CATEGORY_ICONS[category]}
                      </span>
                      <span>{CATEGORY_LABELS[category]}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {filteredTagsByCategory[category].length}
                      </Badge>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      className="w-64 max-h-[300px] overflow-y-auto"
                      data-merge-tag-picker="true"
                      data-click-to-edit-allowed-overlay="true"
                    >
                      {filteredTagsByCategory[category].map((tag) => (
                        <DropdownMenuItem
                          key={tag.key}
                          onClick={() => handleSelectTag(tag)}
                          className="flex flex-col items-start gap-0.5 py-2"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-sm">
                              {tag.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${CATEGORY_COLORS[category].bg} ${CATEGORY_COLORS[category].text} border-0`}
                            >
                              {tag.example}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {tag.description}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </React.Fragment>
              ))
            )}
          </div>

          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground text-center">
              Tags include default fallbacks
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

export default MergeTagPicker;
