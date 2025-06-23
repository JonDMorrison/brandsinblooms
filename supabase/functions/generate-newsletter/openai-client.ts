
export const generateNewsletterWithOpenAI = async (
  openAIApiKey: string,
  prompt: string
): Promise<string> => {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('Generating personalized, region-specific newsletter with enhanced writing style and NO week number references');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional newsletter writer specializing in garden center communications with extensive knowledge of regional gardening differences across climate zones. Always respond with valid JSON and personalize content based on the company profile and location provided. Create region-specific content that reflects local growing conditions, seasonal timing, weather patterns, and gardening challenges specific to their geographic area. ENHANCED WRITING REQUIREMENTS: Always start with powerful hooks that create curiosity or urgency, never "Welcome to" or generic openings. Agitate before you educate by highlighting common challenges first. Use short paragraphs for mobile readability. Make language visually suggestive. Sound conversational like a local expert. End with clear, specific call-to-actions. Use natural seasonal timing references instead of any numbered references. CRITICAL RULES: ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase - this is completely forbidden. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) to create lists - write only in flowing paragraphs and natural sentences. ABSOLUTELY NEVER mention numbered weeks in any form in the content (including "Week 26", "Week 15", etc.). ABSOLUTELY NEVER start with "Welcome to" or similar generic openings. ABSOLUTELY NEVER use emojis anywhere in the content - keep all text completely emoji-free. If you need to present multiple points, weave them naturally into paragraph form.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
