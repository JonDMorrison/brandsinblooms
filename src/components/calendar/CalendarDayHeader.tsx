
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CalendarDayHeaderProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export const CalendarDayHeader = ({
  date,
  isCurrentMonth,
  isToday,
}: CalendarDayHeaderProps) => {
  const dayNumber = format(date, 'd');

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200",
            isToday && "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200/50 ring-2 ring-blue-100",
            !isToday && isCurrentMonth && "text-gray-700 hover:bg-green-100/50 hover:text-green-700",
            !isCurrentMonth && "text-gray-400"
          )}
        >
          {dayNumber}
        </span>
        {isToday && (
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-0.5 bg-gradient-to-r from-blue-100 to-green-100 text-blue-700 border-blue-200/50 shadow-sm"
          >
            Today
          </Badge>
        )}
      </div>
    </div>
  );
};
