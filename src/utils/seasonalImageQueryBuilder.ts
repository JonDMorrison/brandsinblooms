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
  
  // Build the query combining all contexts
  const themeFragment = themeContext ? `${themeContext.slice(0, 30)}` : 'garden plants';
  const query = `${themeFragment} ${seasonalContext} ${contentModifier}`.trim();
  
  const altText = `${weekPosition} ${monthLower} ${themeFragment} ${contentType} image`;
  
  return { query, altText };
};

// Get seasonal context based on month and week position
const getSeasonalContext = (monthNumber: number, weekPosition: WeekPosition): string => {
  // December specific progression (cold → snow → christmas → new year)
  if (monthNumber === 12) {
    switch (weekPosition) {
      case 'Early':
        return 'cold frost winter early season garden preparing';
      case 'Mid':
        return 'snow winter garden frozen landscape peak season';
      case 'Late':
        return 'christmas holiday decorative festive celebration garden';
      case 'End':
        return 'new year winter reflection planning ahead garden';
    }
  }
  
  // January (new beginnings → winter care → planning → indoor)
  if (monthNumber === 1) {
    switch (weekPosition) {
      case 'Early':
        return 'new year fresh start planning garden indoor';
      case 'Mid':
        return 'winter care frost protection garden maintenance';
      case 'Late':
        return 'seed catalog planning early preparation garden';
      case 'End':
        return 'indoor plants winter garden cozy greenhouse';
    }
  }
  
  // February (late winter → early spring → valentine → awakening)
  if (monthNumber === 2) {
    switch (weekPosition) {
      case 'Early':
        return 'late winter snow melting early signs garden';
      case 'Mid':
        return 'valentine flowers roses romantic garden';
      case 'Late':
        return 'spring awakening early blooms crocus garden';
      case 'End':
        return 'spring preparation soil warming garden ready';
    }
  }
  
  // March (early spring → growth → equinox → blooming)
  if (monthNumber === 3) {
    switch (weekPosition) {
      case 'Early':
        return 'early spring growth new leaves garden awakening';
      case 'Mid':
        return 'spring equinox balance growth garden vibrant';
      case 'Late':
        return 'spring blooms daffodils tulips garden colorful';
      case 'End':
        return 'full spring blossoms flowering garden peak';
    }
  }
  
  // April (spring peak → rain → planting → growth)
  if (monthNumber === 4) {
    switch (weekPosition) {
      case 'Early':
        return 'spring showers rain fresh garden planting';
      case 'Mid':
        return 'peak spring blooming vibrant garden color';
      case 'Late':
        return 'spring planting seedlings vegetables garden';
      case 'End':
        return 'spring growth lush green thriving garden';
    }
  }
  
  // May (late spring → flowers → mother's day → transition)
  if (monthNumber === 5) {
    switch (weekPosition) {
      case 'Early':
        return 'late spring flowering abundant garden blooms';
      case 'Mid':
        return 'mothers day flowers bouquet garden celebration';
      case 'Late':
        return 'spring summer transition warm garden preparing';
      case 'End':
        return 'early summer warmth growing garden thriving';
    }
  }
  
  // June (early summer → roses → solstice → peak growth)
  if (monthNumber === 6) {
    switch (weekPosition) {
      case 'Early':
        return 'early summer roses blooming garden fragrant';
      case 'Mid':
        return 'summer solstice longest day garden peak';
      case 'Late':
        return 'peak summer growth lush garden abundant';
      case 'End':
        return 'summer garden maintenance care watering thriving';
    }
  }
  
  // July (mid summer → heat → flowers → vegetables)
  if (monthNumber === 7) {
    switch (weekPosition) {
      case 'Early':
        return 'mid summer heat warm garden colorful';
      case 'Mid':
        return 'summer flowers vibrant blooming garden peak';
      case 'Late':
        return 'summer vegetables harvest garden produce';
      case 'End':
        return 'late summer abundance garden bounty harvest';
    }
  }
  
  // August (late summer → harvest → heat → preparing)
  if (monthNumber === 8) {
    switch (weekPosition) {
      case 'Early':
        return 'late summer harvest vegetables garden bounty';
      case 'Mid':
        return 'peak harvest tomatoes produce garden abundance';
      case 'Late':
        return 'summer transition cooling garden preparing';
      case 'End':
        return 'early fall hints cooling garden changing';
    }
  }
  
  // September (early fall → back to school → equinox → color)
  if (monthNumber === 9) {
    switch (weekPosition) {
      case 'Early':
        return 'early fall autumn beginning garden transition';
      case 'Mid':
        return 'fall equinox balance autumn garden harvest';
      case 'Late':
        return 'autumn colors changing leaves garden beautiful';
      case 'End':
        return 'fall planting mums chrysanthemums garden colorful';
    }
  }
  
  // October (fall peak → halloween → harvest → pumpkins)
  if (monthNumber === 10) {
    switch (weekPosition) {
      case 'Early':
        return 'peak fall colors vibrant autumn garden';
      case 'Mid':
        return 'fall harvest pumpkins squash garden abundance';
      case 'Late':
        return 'halloween decorative pumpkins autumn garden festive';
      case 'End':
        return 'late fall preparing winter garden transition';
    }
  }
  
  // November (late fall → thanksgiving → harvest → preparing)
  if (monthNumber === 11) {
    switch (weekPosition) {
      case 'Early':
        return 'late fall autumn leaves garden preparing';
      case 'Mid':
        return 'thanksgiving harvest gratitude garden abundance';
      case 'Late':
        return 'pre winter preparation garden protecting';
      case 'End':
        return 'early winter approaching garden dormant preparing';
    }
  }
  
  // Default seasonal descriptors
  return `${weekPosition.toLowerCase()} season garden`;
};

// Get content-type specific modifiers for targeted image selection
const getContentTypeModifier = (contentType: ContentType): string => {
  switch (contentType) {
    case 'facebook':
      return 'engagement community social garden center people';
    case 'instagram':
      return 'beautiful aesthetic inspirational stunning visual';
    case 'blog':
      return 'educational detailed comprehensive informative overview';
    default:
      return 'garden plants';
  }
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