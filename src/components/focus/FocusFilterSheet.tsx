
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
  const filterOptions = [
    { id: 'plant_care', label: 'Plant Care', description: 'Growing tips and plant maintenance' },
    { id: 'decor', label: 'Garden Decor', description: 'Styling and design ideas' },
    { id: 'sale', label: 'Promotions', description: 'Sales and special offers' },
    { id: 'holidays', label: 'Seasonal', description: 'Holiday and seasonal content' }
  ];

  const handleFilterChange = (filterId: keyof FocusFilters, checked: boolean) => {
    onFiltersChange({
      ...filters,
      [filterId]: checked
    });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

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
          {activeCount < 4 && (
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
          
          <div className="space-y-4">
            {filterOptions.map((option) => (
              <div key={option.id} className="flex items-start space-x-3">
                <Checkbox
                  id={option.id}
                  checked={filters[option.id as keyof FocusFilters]}
                  onCheckedChange={(checked) => 
                    handleFilterChange(option.id as keyof FocusFilters, !!checked)
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
          
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onFiltersChange({
                plant_care: true,
                decor: true,
                sale: true,
                holidays: true
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
