
export const getWeekDateRange = (weekNumber: number, year: number) => {
  // Calculate the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Calculate which day of the week January 1st falls on (0 = Sunday, 1 = Monday, etc.)
  const firstDayWeekday = firstDayOfYear.getDay();
  
  // Calculate the date of the first Monday of the year (start of week 1)
  const firstMonday = new Date(firstDayOfYear);
  const daysToFirstMonday = firstDayWeekday === 0 ? 1 : (8 - firstDayWeekday);
  firstMonday.setDate(firstDayOfYear.getDate() + daysToFirstMonday);
  
  // Calculate the start date of the specified week
  const weekStartDate = new Date(firstMonday);
  weekStartDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Calculate the end date of the week (Sunday)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  
  return { startDate: weekStartDate, endDate: weekEndDate };
};

export const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};
