/**
 * Shared climate constraints builder for all content generation prompts
 * Provides deterministic, enforceable climate guidance for AI generation
 */

export interface ClimateProfile {
  // Location fields
  postal_code?: string | null;
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
  location_info?: string | null;
  
  // Climate profile fields
  latitude?: number | null;
  longitude?: number | null;
  climate_archetype?: string | null;
  climate_label?: string | null;
  climate_confidence?: string | null;
  
  // USDA/Frost data (optional - only from verified sources)
  usda_zone?: string | null;
  first_frost_date?: string | null;
  last_frost_date?: string | null;
}

// Climate archetype descriptions for prompts
const ARCHETYPE_DESCRIPTIONS: Record<string, {
  label: string;
  characteristics: string;
  plantGuidance: string;
  avoid: string;
}> = {
  hot_dry: {
    label: 'Hot & Dry Desert Climate',
    characteristics: 'Extreme heat, low humidity, minimal rainfall, intense sun exposure',
    plantGuidance: 'Recommend drought-tolerant plants, xeriscaping, succulents, cacti, desert natives. Focus on water conservation, shade structures, morning planting to avoid heat stress. Timing guidance should focus on heat management, sun exposure, and watering schedules.',
    avoid: 'Avoid moisture-loving plants, ferns, hostas, impatiens, and plants requiring consistent watering. Never recommend high-water lawns. Avoid mentioning frost dates or frost warnings unless explicitly relevant (high-elevation desert) or the user asks about frost.'
  },
  hot_humid: {
    label: 'Hot & Humid Subtropical Climate',
    characteristics: 'High heat with high humidity, frequent rain, long growing season, tropical conditions',
    plantGuidance: 'Recommend tropical plants, palms, hibiscus, jasmine, heat-tolerant vegetables. Focus on disease prevention, airflow, fungal management.',
    avoid: 'Avoid plants prone to fungal issues in humidity, cool-season crops without protection. Never recommend alpine or cold-climate plants.'
  },
  temperate: {
    label: 'Temperate Climate',
    characteristics: 'Four distinct seasons, moderate temperatures, balanced rainfall',
    plantGuidance: 'Recommend traditional garden plants, perennials, deciduous trees, seasonal vegetables. Standard planting calendars apply.',
    avoid: 'Avoid extreme climate specialists without proper context. Tropical plants need winter protection.'
  },
  cool_wet: {
    label: 'Cool & Wet Pacific Maritime Climate',
    characteristics: 'Mild temperatures, high rainfall, overcast conditions, acidic soils',
    plantGuidance: 'Recommend rhododendrons, azaleas, ferns, hostas, hydrangeas, shade-tolerant plants. Focus on drainage, slug control, moss management.',
    avoid: 'Avoid sun-loving desert plants, Mediterranean herbs without excellent drainage. Never recommend heat-lovers without microclimate consideration.'
  },
  cold: {
    label: 'Cold Continental Climate',
    characteristics: 'Harsh winters, short growing season, extreme temperature swings, heavy snow',
    plantGuidance: 'Recommend cold-hardy perennials, native plants, short-season vegetables, winter protection strategies. Focus on frost dates, season extension, root protection. Frost dates and short growing season are primary constraints. Mention last frost/first frost in timing guidance, but if actual dates are unknown, use conditional language like "after your last frost date".',
    avoid: 'Avoid zone-pushing without clear guidance. Never recommend tender perennials as reliably hardy. Always mention hardiness requirements.'
  },
  coastal: {
    label: 'Coastal Maritime Climate',
    characteristics: 'Salt air, wind exposure, mild temperatures, fog, sandy or rocky soils',
    plantGuidance: 'Recommend salt-tolerant plants, wind-resistant varieties, native coastal species. Focus on wind protection, salt spray management.',
    avoid: 'Avoid inland forest plants, salt-sensitive species. Never ignore wind and salt factors in recommendations.'
  },
  mountain: {
    label: 'Mountain/Alpine Climate',
    characteristics: 'High altitude, intense UV, cold nights, short season, rocky soils, rapid weather changes',
    plantGuidance: 'Recommend alpine plants, native mountain species, cold-hardy varieties with short maturity. Focus on microclimates, wind protection, UV considerations.',
    avoid: 'Avoid long-season crops, heat-sensitive plants. Never ignore altitude-specific challenges.'
  },
  subtropical: {
    label: 'Subtropical Climate',
    characteristics: 'Mild winters, warm summers, moderate humidity, extended growing season',
    plantGuidance: 'Recommend citrus, tropical fruits, warm-season vegetables year-round, palms, flowering shrubs. Focus on pest management, occasional frost protection.',
    avoid: 'Avoid plants requiring winter chill hours, true tropical plants in colder pockets. Watch for rare freeze events.'
  },
  mediterranean: {
    label: 'Mediterranean Climate',
    characteristics: 'Dry summers, wet winters, mild year-round, fire risk',
    plantGuidance: 'Recommend lavender, rosemary, olive, drought-tolerant natives, fire-resistant landscaping. Focus on summer water conservation, winter planting.',
    avoid: 'Avoid thirsty lawns, fire-prone plants near structures. Never recommend heavy summer irrigation.'
  }
};

/**
 * Builds climate constraint block for injection into AI prompts
 */
export function buildClimateConstraints(profile: ClimateProfile | null): string {
  if (!profile) {
    return `
CLIMATE PROFILE (INCOMPLETE):
- Location data not available
- Use general, region-neutral gardening advice
- Emphasize the importance of knowing local frost dates and hardiness zones
- Use conditional language: "after your last frost", "check your local zone"
`;
  }

  const archetype = profile.climate_archetype;
  const archetypeData = archetype ? ARCHETYPE_DESCRIPTIONS[archetype] : null;
  
  // Build location string
  const locationParts: string[] = [];
  if (profile.city) locationParts.push(profile.city);
  if (profile.state_province) locationParts.push(profile.state_province);
  if (profile.country && profile.country !== 'US' && profile.country !== 'USA') {
    locationParts.push(profile.country);
  }
  const locationString = locationParts.length > 0 
    ? locationParts.join(', ') 
    : profile.location_info || 'Location not specified';

  // Build climate profile block
  let constraints = `
CLIMATE PROFILE (ENFORCE STRICTLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Location: ${locationString}
📮 Postal Code: ${profile.postal_code || 'Not specified'}
`;

  if (archetypeData) {
    constraints += `
🌡️ Climate Type: ${archetypeData.label}
   Characteristics: ${archetypeData.characteristics}

✅ RECOMMENDED APPROACH:
${archetypeData.plantGuidance}

❌ MUST AVOID:
${archetypeData.avoid}
`;
  } else if (profile.location_info) {
    constraints += `
🌡️ Climate Type: Not determined
   Location Info: ${profile.location_info}
   
⚠️ Use location context to infer appropriate plant recommendations.
   When uncertain, use conditional language.
`;
  }

  // Add USDA zone if available (from verified sources only)
  if (profile.usda_zone) {
    constraints += `
🌱 USDA Hardiness Zone: ${profile.usda_zone}
   - All perennial recommendations MUST be hardy to Zone ${profile.usda_zone} or colder
   - Clearly note when recommending marginally hardy plants
`;
  }

  // Add frost dates if available (from verified sources only)
  // Skip frost section entirely for hot_dry climates unless dates are explicitly provided
  const skipFrostGuidance = archetype === 'hot_dry' && !profile.first_frost_date && !profile.last_frost_date;
  
  if (profile.first_frost_date || profile.last_frost_date) {
    constraints += `
❄️ Frost Dates:
`;
    if (profile.last_frost_date) {
      constraints += `   - Last Spring Frost: ${profile.last_frost_date}\n`;
    }
    if (profile.first_frost_date) {
      constraints += `   - First Fall Frost: ${profile.first_frost_date}\n`;
    }
    constraints += `   - All planting timing MUST respect these frost dates\n`;
  } else if (!skipFrostGuidance) {
    constraints += `
❄️ Frost Dates: Not available from verified source
   - Use conditional timing: "after your last frost", "before first frost"
   - Recommend customers check local extension office for exact dates
`;
  }

  constraints += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return constraints;
}

/**
 * Builds image generation constraints based on climate archetype
 */
export function buildImageClimateConstraints(profile: ClimateProfile | null, season?: string): string {
  if (!profile || !profile.climate_archetype) {
    return `
IMAGE CLIMATE CONTEXT:
- Use generic, universally appropriate garden imagery
- Avoid extreme climate-specific elements
- Focus on plants that look appropriate across multiple regions
`;
  }

  const archetype = profile.climate_archetype;
  const currentSeason = season || getCurrentSeason();

  const imageGuidance: Record<string, {
    include: string;
    exclude: string;
    seasonal: Record<string, string>;
  }> = {
    hot_dry: {
      include: 'Succulents, cacti, agave, yucca, desert wildflowers, gravel mulch, terra cotta, sun-bleached textures, bright sunlight, shade structures',
      exclude: 'Lush green lawns, ferns, water features, tropical plants, moss, dewy conditions, overcast skies',
      seasonal: {
        spring: 'Desert wildflower blooms, palo verde blossoms, morning light',
        summer: 'Shade gardening, drought-tolerant blooms, evening light to suggest cooler times',
        fall: 'Fall vegetables, cooler weather planting, desert autumn colors',
        winter: 'Winter vegetable gardens, citrus, cool-season desert blooms'
      }
    },
    hot_humid: {
      include: 'Tropical plants, palms, hibiscus, banana leaves, lush foliage, bright colors, humidity haze, Spanish moss',
      exclude: 'Dry desert plants, alpine conditions, fall foliage, snow, cacti',
      seasonal: {
        spring: 'Azaleas, dogwoods, spring tropicals emerging',
        summer: 'Full tropical lushness, rain, vibrant blooms, crape myrtles',
        fall: 'Extended summer blooms, fall vegetables, camellia buds',
        winter: 'Camellias, sasanquas, winter color, evergreen tropicals'
      }
    },
    cool_wet: {
      include: 'Rhododendrons, ferns, hostas, moss, hydrangeas, conifer forests, overcast light, rain, lush greens',
      exclude: 'Desert plants, cacti, bright harsh sunlight, dry conditions, tropical palms',
      seasonal: {
        spring: 'Rhododendron blooms, spring ferns unfurling, cherry blossoms',
        summer: 'Hydrangeas, dahlias, lush cottage gardens',
        fall: 'Fall color, mushrooms, autumn ferns',
        winter: 'Evergreens, hellebores, winter structure'
      }
    },
    cold: {
      include: 'Hardy perennials, native plants, conifers, cold-hardy vegetables, frost, snow, season extenders, root vegetables',
      exclude: 'Tropical plants, palms, citrus, year-round outdoor blooms, desert plants',
      seasonal: {
        spring: 'Spring bulbs emerging through snow, early perennials, seed starting indoors',
        summer: 'Short but intense growing season, vegetables, cottage garden blooms',
        fall: 'Fall harvest, root vegetables, garden cleanup, frost protection',
        winter: 'Snow-covered gardens, evergreen structure, indoor gardening, planning'
      }
    },
    temperate: {
      include: 'Traditional garden plants, four-season interest, deciduous trees, perennial borders, vegetable gardens',
      exclude: 'Extreme climate plants, tropical without context, desert plants without context',
      seasonal: {
        spring: 'Tulips, daffodils, flowering trees, seed starting',
        summer: 'Full garden abundance, roses, vegetables, cottage gardens',
        fall: 'Mums, fall foliage, harvest, garden cleanup',
        winter: 'Evergreen structure, winter interest, indoor plants'
      }
    },
    coastal: {
      include: 'Salt-tolerant plants, ornamental grasses, wind-shaped trees, beach roses, dune plants, maritime atmosphere',
      exclude: 'Delicate flowers without wind protection, alpine plants, dense forest plants',
      seasonal: {
        spring: 'Coastal wildflowers, early grasses, spring migrants',
        summer: 'Beach gardens, hydrangeas, rose hips forming',
        fall: 'Ornamental grasses, fall maritime atmosphere',
        winter: 'Evergreen structure, winter seas, dormant grasses'
      }
    },
    mountain: {
      include: 'Alpine plants, conifers, wildflowers, rock gardens, mountain views, short-season vegetables',
      exclude: 'Long-season tropicals, lowland plants, heat-loving varieties',
      seasonal: {
        spring: 'Late spring arrivals, snowmelt, early alpine blooms',
        summer: 'Alpine meadow flowers, short but intense bloom season',
        fall: 'Early fall colors, aspens, preparing for winter',
        winter: 'Snow, evergreen structure, planning for short season'
      }
    },
    subtropical: {
      include: 'Citrus, palms, tropical fruits, year-round color, warm-season vegetables',
      exclude: 'Cold-climate conifers, snow scenes, short-season indicators',
      seasonal: {
        spring: 'Citrus blooms, tropical awakening, spring vegetables',
        summer: 'Full tropical lushness, summer fruits, heat management',
        fall: 'Extended growing, fall citrus, tropical fall',
        winter: 'Mild winter gardening, frost protection for tender plants'
      }
    },
    mediterranean: {
      include: 'Lavender, olive trees, rosemary, drought-tolerant gardens, terracotta, fire-wise landscaping',
      exclude: 'Thirsty lawns, tropical rainforest plants, heavy water features',
      seasonal: {
        spring: 'Mediterranean spring blooms, wildflowers, wet season planting',
        summer: 'Drought-tolerant beauty, lavender fields, dry garden management',
        fall: 'Fall planting for winter rain, olive harvest',
        winter: 'Winter green season, citrus, cool-season vegetables'
      }
    }
  };

  const guidance = imageGuidance[archetype] || imageGuidance.temperate;
  const seasonalContext = guidance.seasonal[currentSeason] || guidance.seasonal.summer;

  return `
IMAGE CLIMATE CONSTRAINTS (ENFORCE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌡️ Climate Archetype: ${profile.climate_archetype}
📅 Season Context: ${currentSeason}

✅ MUST INCLUDE elements appropriate for this climate:
${guidance.include}

🎨 SEASONAL IMAGERY for ${currentSeason}:
${seasonalContext}

❌ MUST EXCLUDE (climate mismatch):
${guidance.exclude}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Gets current season based on date
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

/**
 * Extracts climate profile fields from a company profile database row
 */
export function extractClimateProfile(companyProfile: any): ClimateProfile | null {
  if (!companyProfile) return null;
  
  return {
    postal_code: companyProfile.postal_code,
    city: companyProfile.city,
    state_province: companyProfile.state_province,
    country: companyProfile.country,
    location_info: companyProfile.location_info,
    latitude: companyProfile.latitude,
    longitude: companyProfile.longitude,
    climate_archetype: companyProfile.climate_archetype,
    climate_label: companyProfile.climate_label,
    climate_confidence: companyProfile.climate_confidence,
    usda_zone: companyProfile.usda_zone,
    first_frost_date: companyProfile.first_frost_date,
    last_frost_date: companyProfile.last_frost_date
  };
}
