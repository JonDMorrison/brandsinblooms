import * as React from "react";
import { format, addMonths } from "date-fns";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldTrigger } from "@/components/ui/field-trigger";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NativeSelect } from "@/components/ui/native-select";

interface MonthPickerProps {
  value?: string; // YYYY-MM format
  onChange?: (value: string) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const selectedDate = value ? new Date(`${value}-01`) : undefined;
  const currentDate = new Date();
  
  // Generate quick picks
  const thisMonth = format(currentDate, 'yyyy-MM');
  const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
  const nextQuarter = format(addMonths(currentDate, 3), 'yyyy-MM');

  const quickPicks = [
    { label: "This month", value: thisMonth },
    { label: "Next month", value: nextMonth },
    { label: "Next quarter", value: nextQuarter },
  ];

  // Handle month/year selection in popover
  const handleMonthSelect = (month: number, year: number) => {
    const monthString = `${year}-${String(month + 1).padStart(2, '0')}`;
    onChange?.(monthString);
    setIsOpen(false);
  };

  // Generate year options (current year + 2 years ahead)
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() + i);
  
  // Current month/year for the picker
  const pickerDate = selectedDate || addMonths(currentDate, 1);
  const [pickerYear, setPickerYear] = React.useState(pickerDate.getFullYear());

  // Update picker year when value changes
  React.useEffect(() => {
    if (selectedDate) {
      setPickerYear(selectedDate.getFullYear());
    }
  }, [selectedDate]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Month Picker Button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <FieldTrigger
            leadingIcon={<Calendar className="h-4 w-4" />}
            placeholder="Pick a month"
          >
            {value ? format(new Date(`${value}-01`), "MMMM yyyy") : null}
          </FieldTrigger>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Year Selector */}
            <NativeSelect
              value={pickerYear}
              onChange={(e) => setPickerYear(parseInt(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </NativeSelect>
            
            {/* Month Grid */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, month) => {
                const monthDate = new Date(pickerYear, month, 1);
                const monthValue = format(monthDate, 'yyyy-MM');
                const isSelected = value === monthValue;
                const isPastMonth = monthDate < new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                
                return (
                  <Button
                    key={month}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    disabled={isPastMonth}
                    onClick={() => handleMonthSelect(month, pickerYear)}
                    className="h-8 text-xs"
                  >
                    {format(monthDate, 'MMM')}
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Picks */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Quick picks:</p>
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((pick) => (
            <Button
              key={pick.value}
              variant={value === pick.value ? "default" : "outline"}
              size="sm"
              onClick={() => onChange?.(pick.value)}
              className="text-xs"
            >
              {pick.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Selected Display */}
      {value && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Selected:</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
            <Calendar className="h-3 w-3" />
            {format(new Date(`${value}-01`), "MMMM yyyy")}
          </span>
        </div>
      )}
    </div>
  );
}