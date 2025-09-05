import * as React from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldTrigger } from "@/components/ui/field-trigger";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MonthPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(value.getFullYear());
  const currentDate = new Date();

  // Update picker year when value changes
  React.useEffect(() => {
    setPickerYear(value.getFullYear());
  }, [value]);

  // Handle month selection
  const handleMonthSelect = (month: number) => {
    const newDate = startOfMonth(new Date(pickerYear, month, 1));
    onChange(newDate);
    setIsOpen(false);
  };

  // Navigation between years
  const handlePrevYear = () => setPickerYear(prev => prev - 1);
  const handleNextYear = () => setPickerYear(prev => prev + 1);
  
  // Jump to today
  const handleToday = () => {
    const today = startOfMonth(currentDate);
    onChange(today);
    setPickerYear(today.getFullYear());
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FieldTrigger
          leadingIcon={<Calendar className="h-4 w-4" />}
          placeholder="Pick a month"
          className={cn("w-full rounded-xl border px-4 py-3 text-left hover:bg-muted/50 focus-visible:ring-2", className)}
        >
          {format(value, "MMMM yyyy")}
        </FieldTrigger>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Year Navigation Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevYear}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-lg">
              {pickerYear}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextYear}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const monthDate = new Date(pickerYear, monthIndex, 1);
              const isSelected = format(value, 'yyyy-MM') === format(monthDate, 'yyyy-MM');
              const isPastMonth = monthDate < startOfMonth(currentDate);
              
              return (
                <Button
                  key={monthIndex}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  disabled={isPastMonth}
                  onClick={() => handleMonthSelect(monthIndex)}
                  className={cn(
                    "rounded-lg px-3 py-2 hover:bg-muted focus-visible:ring-2 h-10",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  aria-selected={isSelected}
                >
                  {format(monthDate, 'MMM')}
                </Button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="w-full justify-center text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Today
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}