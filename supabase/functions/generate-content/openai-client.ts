
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 5) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Add progressively stricter instructions with each attempt, but allow formatting
    let enhancedPrompt = prompt;
    if (attempts > 1) {
      enhancedPrompt += `\n\n🚨 REGENERATION ATTEMPT ${attempts} - PREVIOUS ISSUES: ${lastIssues.join(', ')}
      
CRITICAL: The previous attempt had issues. You MUST:
- Write in natural, engaging language appropriate for ${contentType || 'content'}
- Use proper formatting: short paragraphs, bullet points, numbered lists, emojis when appropriate
- NEVER use square brackets like [Company Name] or [Location] - use actual names or "we"/"our"
- Write like a professional garden center expert speaking to customers
- Use formatting that improves readability and engagement
- Create valuable, shareable content that customers will find genuinely helpful
      
IMMEDIATE REJECTION if content contains:
- Any text in square brackets [like this]
- Generic placeholders instead of specific names or "we"/"our" references`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Upgraded from gpt-4o-mini for better quality
        messages: [
          { 
            role: 'system', 
            content: `You are a professional garden center content creator who specializes in creating engaging, valuable social media content that customers love to read and share. 

Your content is known for being:
- Genuinely helpful with practical plant care advice
- Engaging with natural storytelling and seasonal relevance  
- Well-formatted with proper paragraphs, lists, and emojis where appropriate
- Shareable and conversation-starting
- Educational while being accessible to all gardening skill levels

You NEVER use placeholders like [Company Name] - instead use specific names when provided or "we"/"our" for the business. You write content that real garden center customers would want to read, share, and engage with because it provides genuine value and expertise.

CONTENT QUALITY STANDARDS:
- Every post must include at least one practical, actionable plant care tip
- Address seasonal gardening challenges and opportunities
- Use storytelling elements to make plant care relatable and engaging
- Include engagement elements like questions or calls-to-action
- Write with the expertise of a professional horticulturist but the accessibility of a friendly neighbor` 
          },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.7,  // Increased from 0.3 for more creative content
        max_tokens: 1200,  // Increased from 800 to accommodate longer content
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    // Validate content with relaxed rules focused on real issues
    const validation = validateContent(generatedContent, contentType);
    
    if (validation.isValid) {
      console.log(`Content generated successfully on attempt ${attempts}`);
      return { content: generatedContent, attempts, issues: [] };
    }
    
    lastIssues = validation.issues;
    console.log(`Content validation failed (attempt ${attempts}):`, validation.issues);
  }
  
  console.log(`Content generation failed after ${attempts} attempts. Last issues:`, lastIssues);
  throw new Error(`Content generation failed validation after ${attempts} attempts. Issues: ${lastIssues.join(', ')}`);
}
