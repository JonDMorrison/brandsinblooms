
interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description?: string;
  garden_relevance?: string;
  category?: string;
}

export function buildHolidayContentPrompt(
  postType: string,
  holiday: Holiday,
  companyProfile: any
): string {
  const companyName = companyProfile?.company_name || 'Your Garden Center';
  const location = companyProfile?.location_info || 'your local area';
  const specializations = companyProfile?.specializations || 'full-service garden center offerings';
  
  // Extract month and seasonal context from holiday date
  const holidayDate = new Date(holiday.holiday_date);
  const monthName = holidayDate.toLocaleDateString('en-US', { month: 'long' });
  const isCurrentMonth = holidayDate.getMonth() === new Date().getMonth();
  const urgencyText = isCurrentMonth ? 'this month' : `in ${monthName}`;
  
  // Holiday-specific context building
  const holidayContext = `
HOLIDAY CAMPAIGN CONTEXT:
- Holiday: ${holiday.holiday_name} (${monthName})
- Garden Relevance: ${holiday.garden_relevance || `Special ${holiday.holiday_name} gardening opportunities`}
- Seasonal Timing: Perfect timing for ${monthName} gardening activities
- Business: ${companyName} - expert garden center serving ${location}
- Specializations: ${specializations}
- Urgency: Act ${urgencyText} for optimal results
`;

  // Enhanced plant care guidance with holiday focus
  const holidayPlantGuidance = `
HOLIDAY-SPECIFIC CONTENT REQUIREMENTS (CRITICAL):
- Address the unique gardening opportunities that ${holiday.holiday_name} represents
- Include specific seasonal timing advice for ${monthName} garden activities
- Create urgency around ${holiday.holiday_name} as the perfect time for specific actions
- Reference holiday-specific plant varieties, care techniques, or garden projects
- Position ${companyName} as the expert destination for ${holiday.holiday_name} gardening
- Make the holiday the hero of the content, not just a mention
- Include actionable advice customers can implement during ${holiday.holiday_name}
`;

  const basePrompt = `${holidayContext}

${holidayPlantGuidance}

HOLIDAY: ${holiday.holiday_name}
SEASONAL FOCUS: ${holiday.garden_relevance || `${monthName} gardening excellence`}

Create professional ${postType} content specifically for ${holiday.holiday_name}. Content must be:
- Genuinely valuable with holiday-specific plant care advice
- Seasonally urgent with ${monthName} timing recommendations
- Engaging with holiday-focused storytelling that makes this month special
- Professional yet conversational tone that builds expertise around ${holiday.holiday_name}
- Mention ${companyName} naturally as the ${holiday.holiday_name} gardening expert
- Formatted for maximum engagement with holiday-specific calls-to-action`;

  if (postType.toLowerCase() === 'instagram') {
    return `${basePrompt}

INSTAGRAM POST REQUIREMENTS FOR ${holiday.holiday_name.toUpperCase()}:
- 250-350 words of compelling holiday-focused content
- HEADLINE: Create a scroll-stopping hook that leverages ${holiday.holiday_name}
  * Use seasonal urgency: "${monthName} is Your Garden's Golden Opportunity"
  * Create FOMO: "Don't Miss ${holiday.holiday_name}'s Perfect Window"
  * Promise transformation: "Transform Your Garden This ${monthName}"
  * Ask compelling questions: "Ready to Make ${monthName} Your Garden's Best Month?"
- Include 3-4 specific, actionable tips customers can implement during ${holiday.holiday_name}
- Address seasonal plant opportunities unique to ${monthName}
- Use engaging visual storytelling that connects emotionally with the holiday theme
- Include 8-12 relevant hashtags including #${holiday.holiday_name.replace(/\s+/g, '')} #${monthName}Gardening
- Create save-worthy content that positions ${holiday.holiday_name} as crucial timing
- Include seasonal timing urgency: "This ${monthName}, your garden needs..."
- Reference specific plant varieties or garden projects perfect for ${holiday.holiday_name}
- End with compelling call-to-action leveraging the holiday timing

EXAMPLE STRONG OPENING HOOKS FOR ${holiday.holiday_name}:
- "${monthName} is Your Garden's Most Important Month - Here's Why"
- "This ${holiday.holiday_name} Secret Will Transform Your Garden Forever"
- "Don't Wait: ${monthName} is Your Garden's Golden Window"
- "The ${holiday.holiday_name} Mistake 90% of Gardeners Make"
- "${monthName} Garden Game-Changer: What Pros Know That You Don't"

Make ${holiday.holiday_name} the central theme, not just a casual mention. The entire post should revolve around why this holiday/month is special for gardening.`;
  }

  // Add similar enhanced prompts for other content types if needed
  return basePrompt;
}

export function validateHolidayContent(content: string, holiday: Holiday): {
  isValid: boolean;
  issues: string[];
  quality: 'excellent' | 'good' | 'weak';
} {
  const issues: string[] = [];
  const holidayName = holiday.holiday_name.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Check if holiday is prominently featured
  if (!contentLower.includes(holidayName)) {
    issues.push(`Content must prominently feature "${holiday.holiday_name}"`);
  }
  
  // Check for seasonal timing
  const monthName = new Date(holiday.holiday_date).toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  if (!contentLower.includes(monthName)) {
    issues.push(`Content should reference ${monthName} timing`);
  }
  
  // Check for urgency/timing language
  const urgencyWords = ['now', 'today', 'this month', 'perfect time', 'ideal timing', 'don\'t wait'];
  const hasUrgency = urgencyWords.some(word => contentLower.includes(word));
  if (!hasUrgency) {
    issues.push('Content should include seasonal urgency');
  }
  
  // Check for specific plant/garden advice
  const adviceWords = ['plant', 'water', 'fertilize', 'prune', 'seed', 'bloom', 'grow'];
  const hasAdvice = adviceWords.some(word => contentLower.includes(word));
  if (!hasAdvice) {
    issues.push('Content should include specific gardening advice');
  }
  
  // Determine quality
  let quality: 'excellent' | 'good' | 'weak' = 'excellent';
  if (issues.length > 0) quality = 'good';
  if (issues.length > 2) quality = 'weak';
  
  return {
    isValid: issues.length === 0,
    issues,
    quality
  };
}
