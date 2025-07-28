
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
            "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200",
            isToday && "bg-blue-500 text-white",
            !isToday && isCurrentMonth && "text-slate-700 hover:bg-green-100 hover:text-green-700",
            !isCurrentMonth && "text-slate-400"
          )}
        >
          {dayNumber}
        </span>
        {isToday && (
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200"
          >
            Today
          </Badge>
        )}
      </div>
    </div>
  );
};
