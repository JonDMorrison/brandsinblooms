
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  availableCategories: string[];
  onClearFilters: () => void;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategories,
  onCategoryToggle,
  availableCategories,
  onClearFilters
}) => {
  const hasActiveFilters = searchQuery || selectedCategories.length > 0;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search layouts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange('')}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-muted-foreground">Categories:</span>
        {availableCategories.map((category) => (
          <Badge
            key={category}
            variant={selectedCategories.includes(category) ? "default" : "outline"}
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => onCategoryToggle(category)}
          >
            {category}
          </Badge>
        ))}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="ml-2 h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
};
