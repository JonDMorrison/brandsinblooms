
import React from 'react';
import { format } from "date-fns";

interface DateCalendarIconProps {
  dateString: string;
  className?: string;
}

export const DateCalendarIcon = ({ dateString, className = "w-10 h-10" }: DateCalendarIconProps) => {
  const formatDateParts = (dateString: string) => {
    if (!dateString) return { month: "???", day: "??" };
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { month: "???", day: "??" };
      
      const month = format(date, "MMM").toUpperCase();
      const day = format(date, "dd");
      
      return { month, day };
    } catch (error) {
      return { month: "???", day: "??" };
    }
  };

  const { month, day } = formatDateParts(dateString);

  return (
    <div className={`${className} bg-white border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center shadow-sm`}>
      <div className="text-[8px] font-bold text-red-600 leading-none">
        {month}
      </div>
      <div className="text-sm font-bold text-gray-800 leading-none mt-0.5">
        {day}
      </div>
    </div>
  );
};
