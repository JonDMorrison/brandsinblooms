
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
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-medium flex items-center justify-center w-6 h-6 rounded-full",
            isToday && "bg-blue-600 text-white",
            !isToday && isCurrentMonth && "text-gray-700",
            !isCurrentMonth && "text-gray-400"
          )}
        >
          {dayNumber}
        </span>
        {isToday && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700">
            Today
          </Badge>
        )}
      </div>
    </div>
  );
};
