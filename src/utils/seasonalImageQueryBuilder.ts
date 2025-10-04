// Seasonal Image Query Builder
// Generates specific image search queries based on month, week position, content type, and theme

export type WeekPosition = 'Early' | 'Mid' | 'Late' | 'End';
export type ContentType = 'facebook' | 'instagram' | 'blog';

interface SeasonalImageQuery {
  query: string;
  altText: string;
}

// Map week numbers to descriptive periods
export const getWeekPosition = (weekNumber: number): WeekPosition => {
  if (weekNumber === 1) return 'Early';
  if (weekNumber === 2) return 'Mid';
  if (weekNumber === 3) return 'Late';
  return 'End';
};

// Generate time-of-month and season-aware image query
export const buildSeasonalImageQuery = (
  month: string,
  weekNumber: number,
  contentType: ContentType,
  themeContext?: string
): SeasonalImageQuery => {
  const monthLower = month.toLowerCase();
  const weekPosition = getWeekPosition(weekNumber);
  const monthNumber = new Date(Date.parse(month + " 1, 2025")).getMonth() + 1;
  
  // Get seasonal context
  const seasonalContext = getSeasonalContext(monthNumber, weekPosition);
  
  // Get content-type specific modifiers
  const contentModifier = getContentTypeModifier(contentType);
  
  // Extract theme fragment (first 2-3 words for concise queries)
  const themeWords = themeContext ? themeContext.split(' ').slice(0, 3).join(' ') : 'garden plants';
  const query = `${themeWords} ${seasonalContext}`.trim();
  
  const altText = `${weekPosition} ${monthLower} ${themeWords} ${contentType} image`;
  
  return { query, altText };
};

// Get seasonal context based on month and week position
const getSeasonalContext = (monthNumber: number, weekPosition: WeekPosition): string => {
  // Simplified month contexts - concise keywords for better image results
  const monthContexts: Record<number, { early: string; mid: string; late: string; end: string }> = {
    1: { early: 'winter frost cold', mid: 'snow frozen ice', late: 'late winter thaw', end: 'early spring preparing' },
    2: { early: 'winter garden cold', mid: 'valentine flowers hearts', late: 'late winter spring', end: 'early spring buds' },
    3: { early: 'early spring bloom', mid: 'spring garden flowers', late: 'spring peak bloom', end: 'late spring growth' },
    4: { early: 'spring flowers bloom', mid: 'spring garden peak', late: 'late spring summer', end: 'early summer warm' },
    5: { early: 'spring garden flowers', mid: 'mothers day flowers', late: 'late spring bloom', end: 'early summer green' },
    6: { early: 'early summer garden', mid: 'summer flowers bright', late: 'fathers day garden', end: 'summer peak bloom' },
    7: { early: 'summer garden bright', mid: 'midsummer peak flowers', late: 'summer garden vibrant', end: 'late summer warm' },
    8: { early: 'summer garden peak', mid: 'late summer bloom', late: 'summer garden harvest', end: 'early fall transition' },
    9: { early: 'early fall autumn', mid: 'autumn garden colors', late: 'fall harvest garden', end: 'late fall season' },
    10: { early: 'fall autumn colors', mid: 'autumn peak foliage', late: 'halloween pumpkin fall', end: 'late fall preparing' },
    11: { early: 'fall autumn garden', mid: 'thanksgiving fall harvest', late: 'late fall winter', end: 'early winter preparing' },
    12: { early: 'winter frost cold', mid: 'snow winter frozen', late: 'christmas holiday festive', end: 'new year winter' },
  };
  
  const context = monthContexts[monthNumber];
  if (!context) return 'season garden';
  
  switch (weekPosition) {
    case 'Early': return context.early;
    case 'Mid': return context.mid;
    case 'Late': return context.late;
    case 'End': return context.end;
  }
};

// Content-type modifiers removed - they were causing over-filtering
const getContentTypeModifier = (contentType: ContentType): string => {
  return ''; // Simplified - no content modifiers to keep queries clean
};

// Build query with optional context override
export const buildSeasonalQueryWithContext = (
  contentContext: string,
  month?: string,
  weekNumber?: number,
  contentType?: ContentType
): string => {
  if (!month || !weekNumber || !contentType) {
    // Fallback to simple seasonal query
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const currentWeek = Math.ceil(now.getDate() / 7);
    return buildSeasonalImageQuery(monthName, currentWeek, 'instagram', contentContext).query;
  }
  
  return buildSeasonalImageQuery(month, weekNumber, contentType, contentContext).query;
};