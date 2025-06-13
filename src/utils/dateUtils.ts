
// Get ISO week number (Week 1 is the first week with at least 4 days in January)
export const getCurrentWeekNumber = () => {
  const today = new Date();
  return getISOWeekNumber(today);
};

export const getISOWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getWeekDateRange = (weekNumber: number, year: number) => {
  // Calculate the date of the first day of the given ISO week
  const jan4 = new Date(year, 0, 4);
  const jan4WeekDay = jan4.getDay() || 7; // Make Sunday = 7
  
  // Find the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4WeekDay + 1);
  
  // Calculate the Monday of the target week
  const weekStartDate = new Date(week1Monday);
  weekStartDate.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
  
  // Calculate the end date of the week (Sunday)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  
  return { startDate: weekStartDate, endDate: weekEndDate };
};

// Get the date for a specific week number in the current year
export const getDateForWeek = (weekNumber: number, year = new Date().getFullYear()) => {
  const { startDate } = getWeekDateRange(weekNumber, year);
  return startDate;
};

// Convert a date to its ISO week number
export const dateToWeekNumber = (date: Date) => {
  return getISOWeekNumber(date);
};
