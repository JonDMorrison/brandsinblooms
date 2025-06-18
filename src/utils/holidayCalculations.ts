
interface HolidayCalculationRule {
  type: 'fixed' | 'nth_weekday' | 'last_weekday' | 'spring_equinox' | 'summer_solstice' | 'fall_equinox' | 'winter_solstice';
  month?: number;
  day?: number;
  weekday?: number; // 0 = Sunday, 1 = Monday, etc.
  occurrence?: number; // 1st, 2nd, 3rd, 4th occurrence
}

export const calculateHolidayDate = (year: number, rule: HolidayCalculationRule): Date => {
  switch (rule.type) {
    case 'fixed':
      return new Date(year, (rule.month || 1) - 1, rule.day || 1);
    
    case 'nth_weekday':
      return getNthWeekdayOfMonth(year, rule.month || 1, rule.weekday || 0, rule.occurrence || 1);
    
    case 'last_weekday':
      return getLastWeekdayOfMonth(year, rule.month || 1, rule.weekday || 0);
    
    case 'spring_equinox':
      return getSpringEquinox(year);
    
    case 'summer_solstice':
      return getSummerSolstice(year);
    
    case 'fall_equinox':
      return getFallEquinox(year);
    
    case 'winter_solstice':
      return getWinterSolstice(year);
    
    default:
      throw new Error(`Unknown holiday calculation type: ${rule.type}`);
  }
};

const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, occurrence: number): Date => {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  
  // Calculate days to add to get to the first occurrence of the target weekday
  let daysToAdd = weekday - firstWeekday;
  if (daysToAdd < 0) {
    daysToAdd += 7;
  }
  
  // Add additional weeks for the nth occurrence
  daysToAdd += (occurrence - 1) * 7;
  
  return new Date(year, month - 1, 1 + daysToAdd);
};

const getLastWeekdayOfMonth = (year: number, month: number, weekday: number): Date => {
  const lastDay = new Date(year, month, 0); // Last day of the month
  const lastWeekday = lastDay.getDay();
  
  // Calculate how many days to subtract to get to the last occurrence of the target weekday
  let daysToSubtract = lastWeekday - weekday;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }
  
  return new Date(year, month - 1, lastDay.getDate() - daysToSubtract);
};

// Approximate dates for seasonal events (can be refined with astronomical calculations)
const getSpringEquinox = (year: number): Date => {
  // Spring equinox is typically around March 20-21
  return new Date(year, 2, 20); // March 20
};

const getSummerSolstice = (year: number): Date => {
  // Summer solstice is typically around June 20-21
  return new Date(year, 5, 21); // June 21
};

const getFallEquinox = (year: number): Date => {
  // Fall equinox is typically around September 22-23
  return new Date(year, 8, 22); // September 22
};

const getWinterSolstice = (year: number): Date => {
  // Winter solstice is typically around December 21-22
  return new Date(year, 11, 21); // December 21
};

export const formatHolidayDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const processGardenRelevanceTemplate = (template: string, year: number): string => {
  return template.replace(/{year}/g, year.toString());
};
