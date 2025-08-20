export interface MasterWeeklyTheme {
  week_number: number;
  title: string;
  theme: string;
  seasonal_focus: string;
  content_ideas: string;
  prompt?: string;
}

export const MASTER_WEEKLY_THEMES: MasterWeeklyTheme[] = [
  // WINTER - January (Weeks 1-4)
  { 
    week_number: 1, 
    title: "New Year Garden Resolutions", 
    theme: "New Year Garden Resolutions - Week 1", 
    seasonal_focus: "Winter planning and goal setting for the garden year ahead", 
    content_ideas: "Garden goal setting, planning tips, resolution inspiration, winter garden maintenance",
    prompt: "Focus on new year planning and winter garden care"
  },
  { 
    week_number: 2, 
    title: "Winter Tool Maintenance", 
    theme: "Winter Tool Maintenance - Week 2", 
    seasonal_focus: "Tool care and preparation during dormant season", 
    content_ideas: "Tool cleaning, sharpening, maintenance guides, winter storage tips",
    prompt: "Focus on garden tool care and winter preparation"
  },
  { 
    week_number: 3, 
    title: "Indoor Plant Care Focus", 
    theme: "Indoor Plant Care Focus - Week 3", 
    seasonal_focus: "Houseplant care during peak winter conditions", 
    content_ideas: "Houseplant winter care, lighting tips, humidity solutions, pest prevention",
    prompt: "Focus on indoor gardening and houseplant care"
  },
  { 
    week_number: 4, 
    title: "Winter Garden Planning", 
    theme: "Winter Garden Planning - Week 4", 
    seasonal_focus: "Strategic planning for upcoming growing season", 
    content_ideas: "Garden layout planning, seed catalogs, crop rotation, space optimization",
    prompt: "Focus on garden design and seasonal planning"
  },

  // LATE WINTER - February (Weeks 5-8)
  { 
    week_number: 5, 
    title: "Seed Starting Preparation", 
    theme: "Seed Starting Preparation - Week 5", 
    seasonal_focus: "Getting ready for early seed starting indoors", 
    content_ideas: "Seed starting supplies, grow lights, timing guides, germination tips",
    prompt: "Focus on seed starting and early growing preparation"
  },
  { 
    week_number: 6, 
    title: "Winter Pruning Basics", 
    theme: "Winter Pruning Basics - Week 6", 
    seasonal_focus: "Dormant season pruning for trees and shrubs", 
    content_ideas: "Pruning techniques, timing guides, tool selection, tree health",
    prompt: "Focus on pruning and dormant season tree care"
  },
  { 
    week_number: 7, 
    title: "Garden Structure Projects", 
    theme: "Garden Structure Projects - Week 7", 
    seasonal_focus: "Building and planning garden infrastructure", 
    content_ideas: "Raised bed construction, trellis building, path planning, fencing projects",
    prompt: "Focus on garden infrastructure and structural improvements"
  },
  { 
    week_number: 8, 
    title: "Compost and Soil Health", 
    theme: "Compost and Soil Health - Week 8", 
    seasonal_focus: "Soil preparation and composting during winter", 
    content_ideas: "Composting basics, soil testing, amendment planning, winter composting",
    prompt: "Focus on soil health and composting systems"
  },

  // EARLY SPRING - March (Weeks 9-12)
  { 
    week_number: 9, 
    title: "Spring Awakening", 
    theme: "Spring Awakening - Week 9", 
    seasonal_focus: "Early spring garden activation and preparation", 
    content_ideas: "Spring cleanup, garden assessment, early planting prep, tool readiness",
    prompt: "Focus on early spring garden preparation and cleanup"
  },
  { 
    week_number: 10, 
    title: "Cool Season Planting", 
    theme: "Cool Season Planting - Week 10", 
    seasonal_focus: "First plantings of cool-weather crops", 
    content_ideas: "Cool season vegetables, early flowers, frost protection, timing guides",
    prompt: "Focus on cool weather planting and spring vegetables"
  },
  { 
    week_number: 11, 
    title: "Soil Preparation Time", 
    theme: "Soil Preparation Time - Week 11", 
    seasonal_focus: "Spring soil work and bed preparation", 
    content_ideas: "Soil amendment, bed preparation, drainage, fertilizer application",
    prompt: "Focus on soil preparation and spring bed readiness"
  },
  { 
    week_number: 12, 
    title: "Early Spring Fertilization", 
    theme: "Early Spring Fertilization - Week 12", 
    seasonal_focus: "Feeding plants as they emerge from dormancy", 
    content_ideas: "Spring fertilizing, organic amendments, lawn care, tree feeding",
    prompt: "Focus on spring fertilization and plant nutrition"
  },

  // MID SPRING - April (Weeks 13-17)
  { 
    week_number: 13, 
    title: "Spring Flower Power", 
    theme: "Spring Flower Power - Week 13", 
    seasonal_focus: "Spring blooms and early flowering plants", 
    content_ideas: "Spring bulbs, early perennials, flowering trees, color combinations",
    prompt: "Focus on spring flowers and early season color"
  },
  { 
    week_number: 14, 
    title: "Vegetable Garden Startup", 
    theme: "Vegetable Garden Startup - Week 14", 
    seasonal_focus: "Getting the vegetable garden ready for prime season", 
    content_ideas: "Garden bed prep, succession planting, companion planting, layout tips",
    prompt: "Focus on vegetable garden planning and early planting"
  },
  { 
    week_number: 15, 
    title: "Lawn Revival Season", 
    theme: "Lawn Revival Season - Week 15", 
    seasonal_focus: "Spring lawn care and renovation", 
    content_ideas: "Lawn fertilizing, overseeding, weed control, spring maintenance",
    prompt: "Focus on lawn care and grass health"
  },
  { 
    week_number: 16, 
    title: "Pest Prevention Prep", 
    theme: "Pest Prevention Prep - Week 16", 
    seasonal_focus: "Getting ahead of common garden pests", 
    content_ideas: "IPM strategies, beneficial insects, organic controls, early intervention",
    prompt: "Focus on pest management and prevention strategies"
  },
  { 
    week_number: 17, 
    title: "Container Garden Creation", 
    theme: "Container Garden Creation - Week 17", 
    seasonal_focus: "Starting container gardens for the season", 
    content_ideas: "Container selection, potting mix, plant combinations, care tips",
    prompt: "Focus on container gardening and portable growing"
  },

  // LATE SPRING - May (Weeks 18-21)
  { 
    week_number: 18, 
    title: "Last Frost Preparations", 
    theme: "Last Frost Preparations - Week 18", 
    seasonal_focus: "Preparing for last frost and warm season planting", 
    content_ideas: "Frost protection, hardening off, planting timing, weather watching",
    prompt: "Focus on frost protection and transition to warm weather"
  },
  { 
    week_number: 19, 
    title: "Pollinator Paradise Setup", 
    theme: "Pollinator Paradise Setup - Week 19", 
    seasonal_focus: "Creating gardens that support beneficial insects", 
    content_ideas: "Pollinator plants, native flowers, bee houses, butterfly gardens",
    prompt: "Focus on pollinator support and beneficial insect habitat"
  },
  { 
    week_number: 20, 
    title: "Warm Weather Planting", 
    theme: "Warm Weather Planting - Week 20", 
    seasonal_focus: "Planting heat-loving crops and flowers", 
    content_ideas: "Tomatoes, peppers, warm season flowers, heat tolerance, spacing",
    prompt: "Focus on warm season crops and heat-loving plants"
  },
  { 
    week_number: 21, 
    title: "Mother's Day Garden Gifts", 
    theme: "Mother's Day Garden Gifts - Week 21", 
    seasonal_focus: "Garden-themed gifts and family gardening", 
    content_ideas: "Garden gift ideas, family projects, teaching kids to garden, flower arrangements",
    prompt: "Focus on garden gifts and family gardening activities"
  },

  // EARLY SUMMER - June (Weeks 22-26)
  { 
    week_number: 22, 
    title: "Summer Garden Kickoff", 
    theme: "Summer Garden Kickoff - Week 22", 
    seasonal_focus: "Transitioning into full summer growing mode", 
    content_ideas: "Summer care routines, watering systems, mulching, heat preparation",
    prompt: "Focus on summer garden preparation and care systems"
  },
  { 
    week_number: 23, 
    title: "Water Wise Gardening", 
    theme: "Water Wise Gardening - Week 23", 
    seasonal_focus: "Efficient watering and drought preparation", 
    content_ideas: "Irrigation systems, water conservation, drought-tolerant plants, mulching",
    prompt: "Focus on water conservation and efficient irrigation"
  },
  { 
    week_number: 24, 
    title: "Summer Flower Maintenance", 
    theme: "Summer Flower Maintenance - Week 24", 
    seasonal_focus: "Keeping flowers blooming through summer heat", 
    content_ideas: "Deadheading, summer pruning, flower care, continuous blooms",
    prompt: "Focus on flower care and maintaining summer blooms"
  },
  { 
    week_number: 25, 
    title: "First Harvest Celebrations", 
    theme: "First Harvest Celebrations - Week 25", 
    seasonal_focus: "Enjoying early summer harvests", 
    content_ideas: "Early harvests, preservation tips, cooking with garden produce, sharing abundance",
    prompt: "Focus on harvest timing and enjoying garden produce"
  },
  { 
    week_number: 26, 
    title: "Midsummer Garden Care", 
    theme: "Midsummer Garden Care - Week 26", 
    seasonal_focus: "Peak summer maintenance and care", 
    content_ideas: "Heat stress management, consistent watering, pest monitoring, plant support",
    prompt: "Focus on midsummer plant care and heat management"
  },

  // MID SUMMER - July (Weeks 27-30)
  { 
    week_number: 27, 
    title: "Beat the Heat Strategies", 
    theme: "Beat the Heat Strategies - Week 27", 
    seasonal_focus: "Helping gardens survive peak summer heat", 
    content_ideas: "Heat protection, shade solutions, cooling techniques, stress indicators",
    prompt: "Focus on heat protection and summer plant survival"
  },
  { 
    week_number: 28, 
    title: "Summer Pest & Disease Watch", 
    theme: "Summer Pest & Disease Watch - Week 28", 
    seasonal_focus: "Managing peak pest and disease pressure", 
    content_ideas: "Common summer pests, disease prevention, organic treatments, monitoring tips",
    prompt: "Focus on pest and disease management during summer"
  },
  { 
    week_number: 29, 
    title: "Peak Harvest Season", 
    theme: "Peak Harvest Season - Week 29", 
    seasonal_focus: "Managing abundant summer harvests", 
    content_ideas: "Harvest timing, storage methods, preservation techniques, recipe ideas",
    prompt: "Focus on harvest management and food preservation"
  },
  { 
    week_number: 30, 
    title: "Summer Garden Projects", 
    theme: "Summer Garden Projects - Week 30", 
    seasonal_focus: "Garden improvements during growing season", 
    content_ideas: "Mid-season improvements, path maintenance, structure repairs, additions",
    prompt: "Focus on garden infrastructure and mid-season projects"
  },

  // LATE SUMMER - August (Weeks 31-35)
  { 
    week_number: 31, 
    title: "Late Summer Planting", 
    theme: "Late Summer Planting - Week 31", 
    seasonal_focus: "Second season crops and fall preparation", 
    content_ideas: "Fall vegetables, second plantings, succession crops, timing guides",
    prompt: "Focus on late summer planting and fall garden prep"
  },
  { 
    week_number: 32, 
    title: "Seed Saving Basics", 
    theme: "Seed Saving Basics - Week 32", 
    seasonal_focus: "Collecting and preserving seeds for next year", 
    content_ideas: "Seed collection, drying techniques, storage methods, best varieties",
    prompt: "Focus on seed saving and preservation techniques"
  },
  { 
    week_number: 33, 
    title: "Late Summer Maintenance", 
    theme: "Late Summer Maintenance - Week 33", 
    seasonal_focus: "Keeping gardens productive into late summer", 
    content_ideas: "Plant renewal, pruning, deadheading, care routines, stress management",
    prompt: "Focus on late summer plant care and maintenance"
  },
  { 
    week_number: 34, 
    title: "Preparing for Autumn", 
    theme: "Preparing for Autumn - Week 34", 
    seasonal_focus: "Getting ready for the fall season transition", 
    content_ideas: "Fall prep, season extension, autumn planning, transition care",
    prompt: "Focus on preparing gardens for autumn transition"
  },
  { 
    week_number: 35, 
    title: "Back-to-School Garden Learning", 
    theme: "Back-to-School Garden Learning - Week 35", 
    seasonal_focus: "Educational gardening activities for the school season", 
    content_ideas: "Teaching kids about plants, school garden projects, educational activities, science connections",
    prompt: "Focus on educational gardening and teaching opportunities"
  },

  // EARLY FALL - September (Weeks 36-39)
  { 
    week_number: 36, 
    title: "Fall Planting Season", 
    theme: "Fall Planting Season - Week 36", 
    seasonal_focus: "Optimal time for fall and spring flower planting", 
    content_ideas: "Fall bulbs, perennial planting, tree planting, fall vegetables",
    prompt: "Focus on fall planting opportunities and timing"
  },
  { 
    week_number: 37, 
    title: "Autumn Color Preparation", 
    theme: "Autumn Color Preparation - Week 37", 
    seasonal_focus: "Planning and caring for fall color displays", 
    content_ideas: "Fall foliage, autumn flowers, seasonal decorations, color combinations",
    prompt: "Focus on autumn color and seasonal beauty"
  },
  { 
    week_number: 38, 
    title: "Harvest Preservation", 
    theme: "Harvest Preservation - Week 38", 
    seasonal_focus: "Preserving the bounty of the growing season", 
    content_ideas: "Canning, freezing, drying, root storage, preservation methods",
    prompt: "Focus on food preservation and harvest storage"
  },
  { 
    week_number: 39, 
    title: "Fall Lawn Care", 
    theme: "Fall Lawn Care - Week 39", 
    seasonal_focus: "Autumn lawn maintenance and winterization", 
    content_ideas: "Fall fertilizing, overseeding, aeration, leaf management, winter prep",
    prompt: "Focus on fall lawn care and grass health"
  },

  // MID FALL - October (Weeks 40-43)
  { 
    week_number: 40, 
    title: "Fall Garden Cleanup Begins", 
    theme: "Fall Garden Cleanup Begins - Week 40", 
    seasonal_focus: "Starting autumn garden maintenance tasks", 
    content_ideas: "Cleanup priorities, composting leaves, plant removal, organization",
    prompt: "Focus on fall cleanup and garden organization"
  },
  { 
    week_number: 41, 
    title: "Bulbs for Spring Color", 
    theme: "Bulbs for Spring Color - Week 41", 
    seasonal_focus: "Planting spring bulbs for next year's display", 
    content_ideas: "Bulb selection, planting depth, spacing, care tips, design ideas",
    prompt: "Focus on spring bulb planting and design"
  },
  { 
    week_number: 42, 
    title: "Tree and Shrub Care", 
    theme: "Tree and Shrub Care - Week 42", 
    seasonal_focus: "Fall care for woody plants and trees", 
    content_ideas: "Fall pruning, mulching, watering, protection, health assessment",
    prompt: "Focus on tree and shrub health and fall care"
  },
  { 
    week_number: 43, 
    title: "Halloween Garden Decor", 
    theme: "Halloween Garden Decor - Week 43", 
    seasonal_focus: "Seasonal decorating with garden materials", 
    content_ideas: "Pumpkins, gourds, autumn decorations, seasonal displays, harvest themes",
    prompt: "Focus on seasonal decorating and autumn celebrations"
  },

  // LATE FALL - November (Weeks 44-47)
  { 
    week_number: 44, 
    title: "Winter Protection Setup", 
    theme: "Winter Protection Setup - Week 44", 
    seasonal_focus: "Preparing plants for winter conditions", 
    content_ideas: "Plant protection, mulching, wrapping, covering, winter prep",
    prompt: "Focus on winter plant protection and preparation"
  },
  { 
    week_number: 45, 
    title: "Tool Winterization", 
    theme: "Tool Winterization - Week 45", 
    seasonal_focus: "Preparing garden tools for winter storage", 
    content_ideas: "Tool cleaning, maintenance, storage, winter care, organization",
    prompt: "Focus on tool maintenance and winter storage"
  },
  { 
    week_number: 46, 
    title: "Thanksgiving Garden Gratitude", 
    theme: "Thanksgiving Garden Gratitude - Week 46", 
    seasonal_focus: "Celebrating the garden year and giving thanks", 
    content_ideas: "Thanksgiving decorations, gratitude practices, garden reflections, harvest celebrations",
    prompt: "Focus on gratitude and celebrating garden achievements"
  },
  { 
    week_number: 47, 
    title: "Late Fall Cleanup", 
    theme: "Late Fall Cleanup - Week 47", 
    seasonal_focus: "Final fall cleanup tasks before winter", 
    content_ideas: "Final cleanup, composting, mulching, protection, winter readiness",
    prompt: "Focus on final fall tasks and winter preparation"
  },

  // EARLY WINTER - December (Weeks 48-52)
  { 
    week_number: 48, 
    title: "Winter Garden Planning", 
    theme: "Winter Garden Planning - Week 48", 
    seasonal_focus: "Planning next year's garden during winter", 
    content_ideas: "Garden planning, seed catalogs, design changes, improvement ideas",
    prompt: "Focus on next year's garden planning and design"
  },
  { 
    week_number: 49, 
    title: "Holiday Plant Care", 
    theme: "Holiday Plant Care - Week 49", 
    seasonal_focus: "Caring for holiday plants and decorations", 
    content_ideas: "Poinsettias, Christmas trees, holiday plants, indoor care, seasonal plants",
    prompt: "Focus on holiday plant care and seasonal decorations"
  },
  { 
    week_number: 50, 
    title: "Garden Gift Ideas", 
    theme: "Garden Gift Ideas - Week 50", 
    seasonal_focus: "Garden-related gifts for the holidays", 
    content_ideas: "Garden gifts, tool recommendations, plant gifts, garden books, accessories",
    prompt: "Focus on garden gifts and holiday giving"
  },
  { 
    week_number: 51, 
    title: "Year-End Garden Review", 
    theme: "Year-End Garden Review - Week 51", 
    seasonal_focus: "Reflecting on the garden year and planning ahead", 
    content_ideas: "Garden journaling, success evaluation, lessons learned, planning improvements",
    prompt: "Focus on garden reflection and year-end assessment"
  },
  { 
    week_number: 52, 
    title: "Winter Garden Dreams", 
    theme: "Winter Garden Dreams - Week 52", 
    seasonal_focus: "Dreaming and planning for next year's garden", 
    content_ideas: "New year planning, garden dreams, inspiration, goal setting, winter projects",
    prompt: "Focus on garden inspiration and new year planning"
  }
];