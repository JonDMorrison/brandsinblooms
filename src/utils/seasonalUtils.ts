
import { getCurrentWeekNumber } from './dateUtils';

export interface SeasonalInfo {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  monthName: string;
  weekInSeason: number;
}

export const getCurrentSeason = (): SeasonalInfo => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const weekNumber = getCurrentWeekNumber();
  
  let season: 'spring' | 'summer' | 'fall' | 'winter';
  let weekInSeason: number;
  
  if (month >= 2 && month <= 4) {
    // March-May: Spring (weeks 10-22)
    season = 'spring';
    weekInSeason = Math.max(1, weekNumber - 9);
  } else if (month >= 5 && month <= 7) {
    // June-August: Summer (weeks 23-35)
    season = 'summer';
    weekInSeason = Math.max(1, weekNumber - 22);
  } else if (month >= 8 && month <= 10) {
    // September-November: Fall (weeks 36-48)
    season = 'fall';
    weekInSeason = Math.max(1, weekNumber - 35);
  } else {
    // December-February: Winter (weeks 49-52, 1-9)
    season = 'winter';
    weekInSeason = weekNumber >= 49 ? weekNumber - 48 : weekNumber + 5;
  }
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return {
    season,
    monthName: monthNames[month],
    weekInSeason
  };
};

export const detectThemeSeason = (theme: any): 'spring' | 'summer' | 'fall' | 'winter' | 'neutral' => {
  const title = (theme.title || '').toLowerCase();
  const description = (theme.description || '').toLowerCase();
  const content = (theme.content_ideas || '').toLowerCase();
  const seasonal = (theme.seasonal_focus || '').toLowerCase();
  
  const allText = `${title} ${description} ${content} ${seasonal}`;
  
  // Spring indicators
  if (allText.includes('spring') || allText.includes('early season') || 
      allText.includes('awakening') || allText.includes('renewal') ||
      allText.includes('seed starting') || allText.includes('soil preparation')) {
    return 'spring';
  }
  
  // Summer indicators  
  if (allText.includes('summer') || allText.includes('heat') || 
      allText.includes('watering') || allText.includes('harvest') ||
      allText.includes('irrigation') || allText.includes('heat-tolerant')) {
    return 'summer';
  }
  
  // Fall indicators
  if (allText.includes('fall') || allText.includes('autumn') || 
      allText.includes('planting') || allText.includes('cleanup') ||
      allText.includes('winter prep') || allText.includes('bulb')) {
    return 'fall';
  }
  
  // Winter indicators
  if (allText.includes('winter') || allText.includes('indoor') || 
      allText.includes('holiday') || allText.includes('planning') ||
      allText.includes('houseplant') || allText.includes('greenhouse')) {
    return 'winter';
  }
  
  return 'neutral';
};

export const calculateSeasonalScore = (theme: any, currentWeek: number): number => {
  const currentSeason = getCurrentSeason();
  const themeSeason = detectThemeSeason(theme);
  const themeWeek = theme.week_number || currentWeek;
  
  let seasonalScore = 0;
  
  // Perfect match: current season = theme season
  if (themeSeason === currentSeason.season) {
    seasonalScore = 100;
  }
  // Good match: neutral themes work in any season
  else if (themeSeason === 'neutral') {
    seasonalScore = 80;
  }
  // Future planning: next season themes (3-4 weeks ahead)
  else if (isNextSeasonTheme(themeSeason, currentSeason.season, themeWeek, currentWeek)) {
    seasonalScore = 60;
  }
  // Poor match: wrong season entirely
  else {
    seasonalScore = 20;
  }
  
  // Adjust score based on week proximity (closer weeks get slight boost)
  const weekDifference = Math.abs(themeWeek - currentWeek);
  if (weekDifference <= 2) {
    seasonalScore += 10;
  } else if (weekDifference <= 4) {
    seasonalScore += 5;
  }
  
  return seasonalScore;
};

const isNextSeasonTheme = (
  themeSeason: string, 
  currentSeason: string, 
  themeWeek: number, 
  currentWeek: number
): boolean => {
  const weekDifference = themeWeek - currentWeek;
  
  // Only consider themes 3-6 weeks ahead as "planning ahead"
  if (weekDifference < 3 || weekDifference > 6) {
    return false;
  }
  
  // Check if it's the logical next season
  const seasonOrder = ['winter', 'spring', 'summer', 'fall'];
  const currentIndex = seasonOrder.indexOf(currentSeason);
  const nextSeasonIndex = (currentIndex + 1) % 4;
  const nextSeason = seasonOrder[nextSeasonIndex];
  
  return themeSeason === nextSeason;
};

export const shouldShowPlanningAheadLabel = (theme: any, currentWeek: number): boolean => {
  const themeWeek = theme.week_number || currentWeek;
  const weekDifference = themeWeek - currentWeek;
  
  // Show "Planning Ahead" for themes 3+ weeks in the future
  return weekDifference >= 3;
};
