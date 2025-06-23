
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 5) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Add progressively stricter instructions with each attempt
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
${contentType?.toLowerCase() === 'instagram' ? `
- START with a scroll-stopping hook that makes people stop scrolling
- Use power words and emotional triggers in the opening
- Create curiosity gaps and promise specific benefits
- Include emojis and visual elements for engagement
- End with a question that encourages comments and saves` : ''}
      
IMMEDIATE REJECTION if content contains:
- Any text in square brackets [like this]
- Generic placeholders instead of specific names or "we"/"our" references
- Boring, generic headlines that don't create engagement
${contentType?.toLowerCase() === 'instagram' ? '- Weak opening that doesn\'t stop the scroll' : ''}`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Use upgraded model for better quality
        temperature: contentType?.toLowerCase() === 'instagram' ? 0.8 : 0.7, // Higher creativity for Instagram
        messages: [
          { 
            role: 'system', 
            content: `You are a professional garden center content creator who specializes in creating engaging, scroll-stopping social media content that customers love to read and share. 

Your content is known for being:
- Genuinely helpful with practical plant care advice
- Engaging with natural storytelling and seasonal relevance  
- Well-formatted with proper paragraphs, lists, and emojis where appropriate
- Shareable and conversation-starting
- Educational while being accessible to all gardening skill levels
${contentType?.toLowerCase() === 'instagram' ? `
- SCROLL-STOPPING with hooks that make people stop and read
- Visual and engaging with emojis and formatting that works on mobile
- Save-worthy content that customers reference again and again
- Question-ending to encourage comments and engagement` : ''}

You NEVER use placeholders like [Company Name] - instead use specific names when provided or "we"/"our" for the business. You write content that creates genuine engagement and provides real value to garden center customers.` 
          },
          { 
            role: 'user', 
            content: enhancedPrompt 
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log(`Generated content attempt ${attempts} for ${contentType}:`, content.substring(0, 200) + '...');
    
    // Validate the generated content
    const validation = validateContent(content, contentType);
    
    if (validation.isValid || attempts === maxAttempts) {
      console.log(`Content generation completed after ${attempts} attempts`, validation.issues);
      return {
        content,
        attempts,
        issues: validation.issues
      };
    }
    
    lastIssues = validation.issues;
    console.log(`Attempt ${attempts} failed validation:`, validation.issues);
  }
  
  // This shouldn't be reached, but just in case
  throw new Error('Failed to generate valid content after maximum attempts');
}
