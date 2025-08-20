import { format } from 'date-fns';

/**
 * Seasonal keywords for filtering campaigns
 */
const SEASONAL_KEYWORDS = {
  spring: ['spring', 'fertilizer', 'planting', 'seedling', 'growth', 'germination', 'budding'],
  summer: ['summer', 'watering', 'heat', 'sun protection', 'harvest', 'blooming', 'flowering'],
  fall: ['fall', 'autumn', 'leaf', 'cleanup', 'preparation', 'mulching', 'pruning'],
  winter: ['winter', 'dormant', 'protection', 'frost', 'snow', 'indoor', 'planning']
};

/**
 * Get the season for a given date
 */
export function getSeasonForDate(date: Date): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Detect the season of a campaign based on its theme, title, or description
 */
export function detectCampaignSeason(campaign: any): 'spring' | 'summer' | 'fall' | 'winter' | 'neutral' {
  const textToAnalyze = [
    campaign.theme || '',
    campaign.title || '',
    campaign.description || ''
  ].join(' ').toLowerCase();

  // Check for seasonal keywords
  for (const [season, keywords] of Object.entries(SEASONAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword)) {
        return season as 'spring' | 'summer' | 'fall' | 'winter';
      }
    }
  }

  return 'neutral';
}

/**
 * Check if a campaign is seasonally aligned with its scheduled date
 */
export function isCampaignSeasonallyAligned(campaign: any): boolean {
  if (!campaign.start_date) return true;

  const campaignDate = new Date(campaign.start_date);
  const campaignSeason = detectCampaignSeason(campaign);
  const dateSeason = getSeasonForDate(campaignDate);

  // If campaign is neutral (no seasonal keywords), allow it
  if (campaignSeason === 'neutral') return true;

  // Check if campaign season matches date season
  return campaignSeason === dateSeason;
}

/**
 * Filter campaigns to only include seasonally aligned ones
 */
export function filterSeasonallyAlignedCampaigns(campaigns: any[]): any[] {
  return campaigns.filter(campaign => {
    const isAligned = isCampaignSeasonallyAligned(campaign);
    
    // Log misaligned campaigns for debugging
    if (!isAligned) {
      console.warn(`Filtering out seasonally misaligned campaign:`, {
        title: campaign.title,
        theme: campaign.theme,
        start_date: campaign.start_date,
        detected_season: detectCampaignSeason(campaign),
        date_season: campaign.start_date ? getSeasonForDate(new Date(campaign.start_date)) : 'unknown'
      });
    }
    
    return isAligned;
  });
}