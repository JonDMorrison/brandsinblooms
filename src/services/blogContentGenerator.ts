import { SeasonalPlanTheme } from '@/services/seasonalPlanGenerator';

export interface BlogContentResult {
  title: string;
  description: string;
  fullContent: string;
  tags: string[];
  readingTime: string;
}

// Enhanced blog content generator using the user's specific requirements
export const generateEnhancedBlogContent = (
  theme: SeasonalPlanTheme, 
  month: string, 
  seasonalFocus: string, 
  contentIdea?: string, 
  holidays?: any[]
): BlogContentResult => {
  const focus = contentIdea || seasonalFocus || 'seasonal gardening';
  const holidayContext = holidays && holidays.length > 0 ? ` Plus, discover how to make the most of ${holidays[0].holiday_name} with your garden.` : '';
  
  // Generate comprehensive blog content
  const title = `Complete Guide to ${focus.charAt(0).toUpperCase() + focus.slice(1)} in ${month}`;
  const description = `Your complete guide to ${focus.toLowerCase()} in ${month}. From expert tips and timing to plant selection and care techniques - everything you need for success this season.${holidayContext} Includes step-by-step instructions, troubleshooting guide, and seasonal recipes.`;
  
  const fullContent = generateFullBlogContent(theme, month, focus, holidayContext, holidays);
  
  return {
    title,
    description,
    fullContent,
    tags: [`${month}Gardening`, 'GardenTips', 'SeasonalCare', 'PlantCare', focus.replace(/\s+/g, '')],
    readingTime: '8-10 min read'
  };
};

const generateFullBlogContent = (
  theme: SeasonalPlanTheme, 
  month: string, 
  focus: string, 
  holidayContext: string, 
  holidays?: any[]
): string => {
  const monthLower = month.toLowerCase();
  const focusTitle = focus.charAt(0).toUpperCase() + focus.slice(1);
  const holidayName = holidays && holidays.length > 0 ? holidays[0].holiday_name : null;
  
  return `# Complete Guide to ${focusTitle} in ${month}

## Introduction

Welcome to your comprehensive guide for ${focus.toLowerCase()} during ${month}! This season presents unique opportunities and challenges that every gardener should understand. Whether you're a seasoned pro or just starting your gardening journey, this guide will provide you with expert insights, practical tips, and proven techniques to ensure success this ${monthLower}.

${holidayContext ? `\n## ${holidayName} Garden Connection\n\n${generateHolidaySection(holidayName, month, focus)}\n` : ''}

## Essential ${month} ${focusTitle} Overview

### Why ${month} is Perfect for ${focusTitle}

${month} offers ideal conditions for ${focus.toLowerCase()}. The changing season provides:

- **Optimal Temperature Ranges**: Cool mornings and moderate afternoons create perfect growing conditions
- **Natural Moisture Balance**: Reduced watering needs while maintaining healthy soil moisture
- **Extended Growing Windows**: Longer periods for root establishment and plant adaptation
- **Seasonal Plant Behavior**: Natural plant cycles align with your gardening goals

### Key Benefits of ${month} ${focusTitle}

1. **Cost-Effective Timing**: End-of-season sales and nursery clearances
2. **Reduced Plant Stress**: Cooler temperatures mean less transplant shock
3. **Extended Establishment Time**: Plants can develop strong root systems before winter
4. **Natural Pest Reduction**: Many garden pests become less active in cooler weather

## Step-by-Step ${focusTitle} Instructions

### Phase 1: Planning and Preparation (Week 1)

**Site Assessment**
- Evaluate sun exposure patterns for ${monthLower} conditions
- Test soil drainage and pH levels
- Identify microclimates in your garden space
- Document existing plant performance and health

**Tool and Supply Preparation**
- Clean and sharpen all garden tools
- Stock up on ${monthLower}-appropriate amendments
- Prepare protective coverings for temperature fluctuations
- Organize irrigation systems for seasonal changes

### Phase 2: Implementation (Weeks 2-3)

**Soil Preparation Techniques**
- Add 2-3 inches of compost to planting areas
- Incorporate slow-release fertilizers appropriate for ${monthLower} planting
- Ensure proper drainage to prevent waterlogged conditions
- Create raised beds or mounds for improved drainage if needed

**Plant Selection and Placement**
- Choose varieties suited for your specific hardiness zone
- Consider mature plant sizes for proper spacing
- Group plants with similar water and light requirements
- Plan for seasonal color transitions and winter interest

### Phase 3: Establishment and Care (Week 4 and beyond)

**Watering Strategies**
- Deep, infrequent watering to encourage root development
- Monitor soil moisture 2-3 inches below surface
- Adjust watering frequency based on rainfall and temperature
- Apply mulch to retain moisture and regulate soil temperature

**Ongoing Maintenance**
- Weekly monitoring for pest and disease issues
- Gradual reduction of fertilization as temperatures drop
- Preparation for first frost protection measures
- Documentation of plant performance for future reference

## Expert Plant Selection Guide

### Best Plants for ${month} ${focusTitle}

**Immediate Impact Plants**
- **Ornamental Kale and Cabbage**: Vibrant colors that intensify with cool weather
- **Chrysanthemums**: Classic ${monthLower} bloomers in wide variety of colors
- **Pansies**: Cool-weather champions that thrive in ${monthLower} conditions
- **Ornamental Grasses**: Add texture and movement to ${monthLower} landscapes

**Long-term Establishment Plants**
- **Spring-blooming Bulbs**: Plant now for spectacular spring displays
- **Perennial Flowers**: Establish root systems during cool ${monthLower} weather
- **Shrubs and Trees**: Take advantage of nursery sales and ideal planting conditions
- **Groundcovers**: Spread and establish before winter dormancy

### Regional Considerations

**Northern Regions (Zones 3-5)**
- Focus on cold-hardy varieties
- Complete planting by mid-${monthLower}
- Emphasize spring bulb planting
- Prepare for early frost protection

**Central Regions (Zones 6-7)**
- Extended planting window through late ${monthLower}
- Mix of cool-season annuals and perennial establishment
- Opportunity for both fall color and spring preparation
- Moderate frost protection needs

**Southern Regions (Zones 8-10)**
- Prime planting season for many varieties
- Focus on heat-tolerant plants that prefer cooler establishment
- Extended growing season allows for successive plantings
- Minimal frost protection typically needed

## Care Techniques and Best Practices

### Watering Wisdom for ${month}

**Morning Watering Benefits**
- Allows plants to absorb moisture before temperature changes
- Reduces disease risk from wet foliage overnight
- Takes advantage of natural dew patterns
- Prepares plants for daily temperature fluctuations

**Soil Moisture Management**
- Use finger test: soil should be moist 2-3 inches down
- Install drip irrigation for consistent, efficient watering
- Group plants by water needs for efficient irrigation
- Monitor container plants more frequently as they dry faster

### Fertilization Strategies

**${month} Feeding Schedule**
- Early ${monthLower}: Apply balanced, slow-release fertilizer
- Mid-${monthLower}: Focus on phosphorus for root development
- Late ${monthLower}: Reduce nitrogen to prepare plants for dormancy
- Supplement with compost tea for gentle, organic nutrition

**Organic vs. Synthetic Options**
- **Organic**: Slower release, improves soil biology, environmentally friendly
- **Synthetic**: Quick uptake, precise nutrient control, immediate results
- **Combination Approach**: Use organic as base with synthetic supplements as needed

## Troubleshooting Common ${month} Issues

### Temperature Fluctuation Problems

**Symptoms**
- Wilting during warm afternoons
- Stunted growth or leaf drop
- Color changes in foliage
- Premature flowering or dormancy signals

**Solutions**
- Provide afternoon shade during warm spells
- Increase mulch depth for root zone protection
- Install temporary windbreaks
- Adjust watering schedule for temperature swings

### Pest and Disease Management

**Common ${month} Pests**
- **Aphids**: Concentrate on new growth, multiply rapidly in cool weather
- **Spider Mites**: Thrive in dry conditions common in ${monthLower}
- **Slugs and Snails**: Active in cool, moist ${monthLower} conditions
- **Cutworms**: Feed on young plants at soil level

**Integrated Management Approach**
- Regular monitoring and early intervention
- Encourage beneficial insects with diverse plantings
- Use physical barriers and traps when appropriate
- Apply targeted treatments only when necessary

### Soil and Drainage Issues

**Identifying Problems**
- Standing water after rainfall
- Slow plant growth despite adequate care
- Root rot symptoms in established plants
- Poor germination rates

**Corrective Measures**
- Improve drainage with organic matter incorporation
- Create raised planting areas for better drainage
- Install French drains for persistent water problems
- Adjust planting techniques for heavy or sandy soils

## Seasonal Recipes and Garden-to-Table Ideas

### Fresh ${month} Harvest Recipes

**Roasted Root Vegetable Medley**
Ingredients:
- 2 cups mixed root vegetables from your garden
- 3 tablespoons olive oil
- 1 teaspoon fresh herbs (rosemary, thyme)
- Salt and pepper to taste

Instructions:
1. Preheat oven to 425°F
2. Cut vegetables into uniform pieces for even cooking
3. Toss with oil and seasonings
4. Roast for 25-30 minutes until tender and caramelized

**${month} Garden Salad with Seasonal Greens**
- Fresh lettuce and spinach from cool-weather plantings
- Edible flowers like pansies or nasturtiums
- Homemade vinaigrette using fresh herbs
- Toasted nuts or seeds for crunch and nutrition

### Preserving the ${month} Harvest

**Quick Pickling for Cool-Weather Vegetables**
- Perfect for radishes, turnips, and late-season cucumbers
- Simple brine recipe using vinegar, water, and spices
- Ready to eat in 24 hours
- Stores in refrigerator for up to 1 month

**Herb Preservation Techniques**
- Freezing in ice cubes for long-term storage
- Drying methods for concentrated flavor
- Herb-infused oils and vinegars
- Fresh herb butter for immediate use

## Planning for Next Season

### ${month} Planning Checklist

**Garden Journal Updates**
- Record what worked well this ${monthLower}
- Note varieties that performed exceptionally
- Document weather patterns and their effects
- Plan improvements for next year's ${monthLower} garden

**Seed and Plant Orders**
- Research new varieties for next year
- Take advantage of end-of-season sales
- Order spring bulbs while selection is best
- Plan crop rotations for vegetable gardens

**Infrastructure Improvements**
- Assess irrigation system performance
- Plan new garden bed locations
- Consider tool and storage upgrades
- Schedule major projects for dormant season

### Setting Up for Success

**Soil Improvement Plan**
- Schedule soil testing for spring preparation
- Plan cover crop plantings for unused areas
- Organize compost system improvements
- Research soil amendment options

**Plant Selection Strategy**
- Create wish lists for different garden areas
- Research native plant options for your region
- Plan for four-season interest in plantings
- Consider maintenance requirements for new additions

## Conclusion

Success with ${focus.toLowerCase()} in ${month} comes from understanding the unique opportunities this season provides. By following these expert guidelines, preparing properly, and staying attentive to your plants' needs, you'll create a thriving garden that provides beauty and satisfaction throughout the season.

Remember that gardening is both an art and a science. While these guidelines provide a solid foundation, don't be afraid to experiment and adapt techniques to your specific conditions and preferences. Every garden is unique, and part of the joy of gardening comes from discovering what works best in your particular space.

${holidayContext ? `\nAs you implement these ${focus.toLowerCase()} techniques, take time to appreciate the special connection between your garden and ${holidayName}. This seasonal celebration adds extra meaning to your gardening efforts and provides opportunities to share your garden's bounty with others.\n` : ''}

Take time to enjoy the process, document your successes, and learn from any challenges. Your ${monthLower} garden will reward your efforts with beauty, fresh produce, and the satisfaction that comes from working in harmony with nature's seasonal rhythms.

---

*Happy Gardening! For more seasonal gardening tips and expert advice, visit our garden center or contact our horticultural specialists.*`;
};

const generateHolidaySection = (holidayName: string | null, month: string, focus: string): string => {
  if (!holidayName) return '';
  
  if (holidayName.toLowerCase().includes('vegetarian')) {
    return `This ${month}, ${holidayName} provides the perfect opportunity to showcase your garden's plant-based bounty. Your ${focus.toLowerCase()} efforts can contribute to a more sustainable, plant-forward lifestyle:

**Garden-to-Table Celebration Ideas**
- Harvest fresh vegetables and herbs for vegetarian feast preparation
- Create beautiful displays of colorful, fresh produce
- Share garden-fresh ingredients with friends and family
- Preserve excess harvest through canning, freezing, or drying

**Educational Opportunities**
- Demonstrate the connection between gardening and sustainable eating
- Show children where vegetables come from and how they grow
- Discuss the environmental benefits of home-grown produce
- Create recipe cards featuring your garden's fresh ingredients

**Community Engagement**
- Organize a produce swap with neighbors
- Donate excess harvest to local food banks
- Host a garden tour focusing on edible plants
- Share vegetarian recipes featuring home-grown ingredients`;
  }
  
  return `${holidayName} provides wonderful opportunities to integrate your ${focus.toLowerCase()} efforts with seasonal celebrations. Consider how your garden can enhance this special time:

**Seasonal Decorating Ideas**
- Use plants and flowers from your garden for natural decorations
- Create themed arrangements that reflect both the holiday and season
- Incorporate garden elements into holiday tablescapes
- Design outdoor spaces that complement holiday celebrations

**Gift Ideas from the Garden**
- Potted plants from your propagation efforts
- Homemade preserves from garden harvest
- Seed packets saved from this year's best performers
- Garden-themed craft projects using natural materials`;
};