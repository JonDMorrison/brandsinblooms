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
  
  // Only include relevant holidays that match the theme/focus
  const relevantHoliday = holidays?.find(holiday => 
    isRelevantHoliday(holiday.holiday_name, focus, theme.label)
  );
  const holidayContext = relevantHoliday ? ` Plus, discover how to make the most of ${relevantHoliday.holiday_name} with your garden.` : '';
  
  // Generate comprehensive blog content
  const title = `Complete Guide to ${focus.charAt(0).toUpperCase() + focus.slice(1)} in ${month}`;
  const description = `Your complete guide to ${focus.toLowerCase()} in ${month}. From expert tips and timing to plant selection and care techniques - everything you need for success this season.${holidayContext} Includes step-by-step instructions, troubleshooting guide, and seasonal recipes.`;
  
  const fullContent = generateFullBlogContent(theme, month, focus, holidayContext, relevantHoliday ? [relevantHoliday] : []);
  
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
  
  return `<h1>Complete Guide to ${focusTitle} in ${month}</h1>

<h2>Introduction</h2>

<p>Welcome to your comprehensive guide for ${focus.toLowerCase()} during ${month}! This season presents unique opportunities and challenges that every gardener should understand. Whether you're a seasoned pro or just starting your gardening journey, this guide will provide you with expert insights, practical tips, and proven techniques to ensure success this ${monthLower}.</p>

${holidayContext ? `\n<h2>${holidayName} Garden Connection</h2>\n\n${generateHolidaySection(holidayName, month, focus)}\n` : ''}

<h2>Essential ${month} ${focusTitle} Overview</h2>

<h3>Why ${month} is Perfect for ${focusTitle}</h3>

<p>${month} offers ideal conditions for ${focus.toLowerCase()}. The changing season provides:</p>

<ul>
<li><strong>Optimal Temperature Ranges</strong>: Cool mornings and moderate afternoons create perfect growing conditions</li>
<li><strong>Natural Moisture Balance</strong>: Reduced watering needs while maintaining healthy soil moisture</li>
<li><strong>Extended Growing Windows</strong>: Longer periods for root establishment and plant adaptation</li>
<li><strong>Seasonal Plant Behavior</strong>: Natural plant cycles align with your gardening goals</li>
</ul>

<h3>Key Benefits of ${month} ${focusTitle}</h3>

<ol>
<li><strong>Cost-Effective Timing</strong>: End-of-season sales and nursery clearances</li>
<li><strong>Reduced Plant Stress</strong>: Cooler temperatures mean less transplant shock</li>
<li><strong>Extended Establishment Time</strong>: Plants can develop strong root systems before winter</li>
<li><strong>Natural Pest Reduction</strong>: Many garden pests become less active in cooler weather</li>
</ol>

<h2>Step-by-Step ${focusTitle} Instructions</h2>

<h3>Phase 1: Planning and Preparation (Week 1)</h3>

<p><strong>Site Assessment</strong></p>
<ul>
<li>Evaluate sun exposure patterns for ${monthLower} conditions</li>
<li>Test soil drainage and pH levels</li>
<li>Identify microclimates in your garden space</li>
<li>Document existing plant performance and health</li>
</ul>

<p><strong>Tool and Supply Preparation</strong></p>
<ul>
<li>Clean and sharpen all garden tools</li>
<li>Stock up on ${monthLower}-appropriate amendments</li>
<li>Prepare protective coverings for temperature fluctuations</li>
<li>Organize irrigation systems for seasonal changes</li>
</ul>

<h3>Phase 2: Implementation (Weeks 2-3)</h3>

<p><strong>Soil Preparation Techniques</strong></p>
<ul>
<li>Add 2-3 inches of compost to planting areas</li>
<li>Incorporate slow-release fertilizers appropriate for ${monthLower} planting</li>
<li>Ensure proper drainage to prevent waterlogged conditions</li>
<li>Create raised beds or mounds for improved drainage if needed</li>
</ul>

<p><strong>Plant Selection and Placement</strong></p>
<ul>
<li>Choose varieties suited for your specific hardiness zone</li>
<li>Consider mature plant sizes for proper spacing</li>
<li>Group plants with similar water and light requirements</li>
<li>Plan for seasonal color transitions and winter interest</li>
</ul>

<h3>Phase 3: Establishment and Care (Week 4 and beyond)</h3>

<p><strong>Watering Strategies</strong></p>
<ul>
<li>Deep, infrequent watering to encourage root development</li>
<li>Monitor soil moisture 2-3 inches below surface</li>
<li>Adjust watering frequency based on rainfall and temperature</li>
<li>Apply mulch to retain moisture and regulate soil temperature</li>
</ul>

<p><strong>Ongoing Maintenance</strong></p>
<ul>
<li>Weekly monitoring for pest and disease issues</li>
<li>Gradual reduction of fertilization as temperatures drop</li>
<li>Preparation for first frost protection measures</li>
<li>Documentation of plant performance for future reference</li>
</ul>

<h2>Expert Plant Selection Guide</h2>

<h3>Best Plants for ${month} ${focusTitle}</h3>

<p><strong>Immediate Impact Plants</strong></p>
<ul>
<li><strong>Ornamental Kale and Cabbage</strong>: Vibrant colors that intensify with cool weather</li>
<li><strong>Chrysanthemums</strong>: Classic ${monthLower} bloomers in wide variety of colors</li>
<li><strong>Pansies</strong>: Cool-weather champions that thrive in ${monthLower} conditions</li>
<li><strong>Ornamental Grasses</strong>: Add texture and movement to ${monthLower} landscapes</li>
</ul>

<p><strong>Long-term Establishment Plants</strong></p>
<ul>
<li><strong>Spring-blooming Bulbs</strong>: Plant now for spectacular spring displays</li>
<li><strong>Perennial Flowers</strong>: Establish root systems during cool ${monthLower} weather</li>
<li><strong>Shrubs and Trees</strong>: Take advantage of nursery sales and ideal planting conditions</li>
<li><strong>Groundcovers</strong>: Spread and establish before winter dormancy</li>
</ul>

<h3>Regional Considerations</h3>

<p><strong>Northern Regions (Zones 3-5)</strong></p>
<ul>
<li>Focus on cold-hardy varieties</li>
<li>Complete planting by mid-${monthLower}</li>
<li>Emphasize spring bulb planting</li>
<li>Prepare for early frost protection</li>
</ul>

<p><strong>Central Regions (Zones 6-7)</strong></p>
<ul>
<li>Extended planting window through late ${monthLower}</li>
<li>Mix of cool-season annuals and perennial establishment</li>
<li>Opportunity for both fall color and spring preparation</li>
<li>Moderate frost protection needs</li>
</ul>

<p><strong>Southern Regions (Zones 8-10)</strong></p>
<ul>
<li>Prime planting season for many varieties</li>
<li>Focus on heat-tolerant plants that prefer cooler establishment</li>
<li>Extended growing season allows for successive plantings</li>
<li>Minimal frost protection typically needed</li>
</ul>

<h2>Care Techniques and Best Practices</h2>

<h3>Watering Wisdom for ${month}</h3>

<p><strong>Morning Watering Benefits</strong></p>
<ul>
<li>Allows plants to absorb moisture before temperature changes</li>
<li>Reduces disease risk from wet foliage overnight</li>
<li>Takes advantage of natural dew patterns</li>
<li>Prepares plants for daily temperature fluctuations</li>
</ul>

<p><strong>Soil Moisture Management</strong></p>
<ul>
<li>Use finger test: soil should be moist 2-3 inches down</li>
<li>Install drip irrigation for consistent, efficient watering</li>
<li>Group plants by water needs for efficient irrigation</li>
<li>Monitor container plants more frequently as they dry faster</li>
</ul>

<h3>Fertilization Strategies</h3>

<p><strong>${month} Feeding Schedule</strong></p>
<ul>
<li>Early ${monthLower}: Apply balanced, slow-release fertilizer</li>
<li>Mid-${monthLower}: Focus on phosphorus for root development</li>
<li>Late ${monthLower}: Reduce nitrogen to prepare plants for dormancy</li>
<li>Supplement with compost tea for gentle, organic nutrition</li>
</ul>

<p><strong>Organic vs. Synthetic Options</strong></p>
<ul>
<li><strong>Organic</strong>: Slower release, improves soil biology, environmentally friendly</li>
<li><strong>Synthetic</strong>: Quick uptake, precise nutrient control, immediate results</li>
<li><strong>Combination Approach</strong>: Use organic as base with synthetic supplements as needed</li>
</ul>

<h2>Conclusion</h2>

<p>Success with ${focus.toLowerCase()} in ${month} comes from understanding the unique opportunities this season provides. By following these expert guidelines, preparing properly, and staying attentive to your plants' needs, you'll create a thriving garden that provides beauty and satisfaction throughout the season.</p>

<p>Remember that gardening is both an art and a science. While these guidelines provide a solid foundation, don't be afraid to experiment and adapt techniques to your specific conditions and preferences. Every garden is unique, and part of the joy of gardening comes from discovering what works best in your particular space.</p>

${holidayContext ? `\n<p>As you implement these ${focus.toLowerCase()} techniques, take time to appreciate the special connection between your garden and ${holidayName}. This seasonal celebration adds extra meaning to your gardening efforts and provides opportunities to share your garden's bounty with others.</p>\n` : ''}

<p>Take time to enjoy the process, document your successes, and learn from any challenges. Your ${monthLower} garden will reward your efforts with beauty, fresh produce, and the satisfaction that comes from working in harmony with nature's seasonal rhythms.</p>

<hr>

<p><em>Happy Gardening! For more seasonal gardening tips and expert advice, visit our garden center or contact our horticultural specialists.</em></p>`;
};

// Helper function to check if a holiday is relevant to the garden theme
const isRelevantHoliday = (holidayName: string, focus: string, themeLabel: string): boolean => {
  const holiday = holidayName.toLowerCase();
  const focusLower = focus.toLowerCase();
  const themeLower = themeLabel.toLowerCase();
  
  // Define relevant keyword mappings
  const relevantMappings = {
    vegetarian: ['vegetable', 'harvest', 'garden', 'plant', 'grow'],
    thanksgiving: ['harvest', 'autumn', 'fall', 'gratitude', 'garden'],
    earth: ['garden', 'plant', 'eco', 'green', 'sustainable'],
    harvest: ['harvest', 'autumn', 'fall', 'crop', 'garden'],
    spring: ['spring', 'plant', 'seed', 'grow', 'garden'],
    summer: ['summer', 'garden', 'plant', 'grow'],
    winter: ['winter', 'indoor', 'plant', 'garden']
  };
  
  // Check if holiday matches any relevant themes
  for (const [holidayType, keywords] of Object.entries(relevantMappings)) {
    if (holiday.includes(holidayType)) {
      return keywords.some(keyword => 
        focusLower.includes(keyword) || themeLower.includes(keyword)
      );
    }
  }
  
  return false;
};

const generateHolidaySection = (holidayName: string | null, month: string, focus: string): string => {
  if (!holidayName) return '';
  
  if (holidayName.toLowerCase().includes('vegetarian')) {
    return `<p>This ${month}, ${holidayName} provides the perfect opportunity to showcase your garden's plant-based bounty. Your ${focus.toLowerCase()} efforts can contribute to a more sustainable, plant-forward lifestyle:</p>

<p><strong>Garden-to-Table Celebration Ideas</strong></p>
<ul>
<li>Harvest fresh vegetables and herbs for vegetarian feast preparation</li>
<li>Create beautiful displays of colorful, fresh produce</li>
<li>Share garden-fresh ingredients with friends and family</li>
<li>Preserve excess harvest through canning, freezing, or drying</li>
</ul>

<p><strong>Educational Opportunities</strong></p>
<ul>
<li>Demonstrate the connection between gardening and sustainable eating</li>
<li>Show children where vegetables come from and how they grow</li>
<li>Discuss the environmental benefits of home-grown produce</li>
<li>Create recipe cards featuring your garden's fresh ingredients</li>
</ul>

<p><strong>Community Engagement</strong></p>
<ul>
<li>Organize a produce swap with neighbors</li>
<li>Donate excess harvest to local food banks</li>
<li>Host a garden tour focusing on edible plants</li>
<li>Share vegetarian recipes featuring home-grown ingredients</li>
</ul>`;
  }
  
  return `<p>${holidayName} provides wonderful opportunities to integrate your ${focus.toLowerCase()} efforts with seasonal celebrations. Consider how your garden can enhance this special time:</p>

<p><strong>Seasonal Decorating Ideas</strong></p>
<ul>
<li>Use plants and flowers from your garden for natural decorations</li>
<li>Create themed arrangements that reflect both the holiday and season</li>
<li>Incorporate garden elements into holiday tablescapes</li>
<li>Design outdoor spaces that complement holiday celebrations</li>
</ul>

<p><strong>Gift Ideas from the Garden</strong></p>
<ul>
<li>Potted plants from your propagation efforts</li>
<li>Homemade preserves from garden harvest</li>
<li>Seed packets saved from this year's best performers</li>
<li>Garden-themed craft projects using natural materials</li>
</ul>`;
};