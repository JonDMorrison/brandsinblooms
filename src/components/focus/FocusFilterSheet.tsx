
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter } from 'lucide-react';
import { FocusFilters } from '@/hooks/useFocusThemes';

interface FocusFilterSheetProps {
  filters: FocusFilters;
  onFiltersChange: (filters: FocusFilters) => void;
}

export const FocusFilterSheet = ({ filters, onFiltersChange }: FocusFilterSheetProps) => {
  const categoryOptions = [
    { id: 'plant_care', label: 'Plant Care', description: 'Growing tips and plant maintenance' },
    { id: 'decor', label: 'Garden Decor', description: 'Styling and design ideas' },
    { id: 'sale', label: 'Promotions', description: 'Sales and special offers' },
    { id: 'holidays', label: 'Seasonal', description: 'Holiday and seasonal content' }
  ];

  const difficultyOptions = [
    { id: 'beginner', label: 'Beginner', description: 'Easy tasks for newcomers' },
    { id: 'intermediate', label: 'Intermediate', description: 'Moderate complexity tasks' },
    { id: 'advanced', label: 'Advanced', description: 'Complex, detailed tasks' }
  ];

  const timeOptions = [
    { id: 'quick', label: 'Quick (30 min)', description: 'Fast completion tasks' },
    { id: 'short', label: 'Short (1 hour)', description: 'Brief time commitment' },
    { id: 'medium', label: 'Medium (2-3 hours)', description: 'Moderate time investment' }
  ];

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = checked 
      ? [...filters.categories, categoryId]
      : filters.categories.filter(c => c !== categoryId);
    
    onFiltersChange({
      ...filters,
      categories: newCategories
    });
  };

  const handleDifficultyChange = (difficultyId: string, checked: boolean) => {
    const newDifficulty = checked 
      ? [...filters.difficulty, difficultyId]
      : filters.difficulty.filter(d => d !== difficultyId);
    
    onFiltersChange({
      ...filters,
      difficulty: newDifficulty
    });
  };

  const handleTimeChange = (timeId: string, checked: boolean) => {
    const newTimeCommitment = checked 
      ? [...filters.timeCommitment, timeId]
      : filters.timeCommitment.filter(t => t !== timeId);
    
    onFiltersChange({
      ...filters,
      timeCommitment: newTimeCommitment
    });
  };

  const handleShowCompletedChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      showCompleted: checked
    });
  };

  const activeCount = filters.categories.length + filters.difficulty.length + filters.timeCommitment.length + (filters.showCompleted ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="relative"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#68BEB9] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Content Themes</SheetTitle>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          <p className="text-sm text-gray-600">
            Choose which types of content themes to show in your carousel.
          </p>
          
          {/* Categories Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-gray-900">Categories</h3>
            {categoryOptions.map((option) => (
              <div key={option.id} className="flex items-start space-x-3">
                <Checkbox
                  id={option.id}
                  checked={filters.categories.includes(option.id)}
                  onCheckedChange={(checked) => 
                    handleCategoryChange(option.id, !!checked)
                  }
                />
                <div className="flex-1">
                  <label 
                    htmlFor={option.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Difficulty Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-gray-900">Difficulty Level</h3>
            {difficultyOptions.map((option) => (
              <div key={option.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`difficulty-${option.id}`}
                  checked={filters.difficulty.includes(option.id)}
                  onCheckedChange={(checked) => 
                    handleDifficultyChange(option.id, !!checked)
                  }
                />
                <div className="flex-1">
                  <label 
                    htmlFor={`difficulty-${option.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Time Commitment Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-gray-900">Time Commitment</h3>
            {timeOptions.map((option) => (
              <div key={option.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`time-${option.id}`}
                  checked={filters.timeCommitment.includes(option.id)}
                  onCheckedChange={(checked) => 
                    handleTimeChange(option.id, !!checked)
                  }
                />
                <div className="flex-1">
                  <label 
                    htmlFor={`time-${option.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Show Completed Section */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="show-completed"
                checked={filters.showCompleted}
                onCheckedChange={(checked) => 
                  handleShowCompletedChange(!!checked)
                }
              />
              <div className="flex-1">
                <label 
                  htmlFor="show-completed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Show Completed Themes
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Include themes you've already generated or skipped
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onFiltersChange({
                categories: ['plant_care', 'decor', 'sale', 'holidays'],
                difficulty: ['beginner', 'intermediate', 'advanced'],
                timeCommitment: ['quick', 'short', 'medium'],
                showCompleted: false
              })}
              className="w-full"
            >
              Select All
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
