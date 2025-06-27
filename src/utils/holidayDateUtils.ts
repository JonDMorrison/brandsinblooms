
export const calculateDaysUntilHoliday = (holidayDate: string): number => {
  const today = new Date();
  const holiday = new Date(holidayDate);
  
  // Set both dates to current year for comparison
  const currentYear = today.getFullYear();
  const holidayThisYear = new Date(currentYear, holiday.getMonth(), holiday.getDate());
  
  // If holiday has passed this year, use next year's date
  if (holidayThisYear < today) {
    holidayThisYear.setFullYear(currentYear + 1);
  }
  
  // Calculate days difference
  const timeDiff = holidayThisYear.getTime() - today.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

export const sortHolidaysByProximity = (holidays: any[]) => {
  return holidays.sort((a, b) => {
    const daysUntilA = calculateDaysUntilHoliday(a.holiday_date);
    const daysUntilB = calculateDaysUntilHoliday(b.holiday_date);
    return daysUntilA - daysUntilB;
  });
};
