
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 3) {
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
- Use proper formatting: short paragraphs, bullet points, numbered lists where helpful
- NEVER use square brackets like [Company Name] or [Location] - use actual names or "we"/"our"
- Write like a professional garden center expert speaking to customers
${contentType === 'instagram' ? '- Use emojis and social media formatting naturally' : '- Use formatting that improves readability'}
      
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
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a professional garden center content writer who creates engaging, well-formatted content. You use natural formatting including paragraphs, bullet points, and lists to improve readability. You NEVER use placeholders like [Company Name] - instead use specific names when provided or "we"/"our" for the business.

CONTENT FORMATTING GUIDELINES:
1. Use short, readable paragraphs (2-3 sentences)
2. Use bullet points or numbered lists when they improve clarity
3. Include emojis for social media content when appropriate
4. Use proper spacing and formatting for the content type
5. Write conversationally but professionally
${contentType === 'instagram' ? '6. For Instagram: Use natural social media formatting with emojis and hashtags' : '6. Format appropriately for the content type'}

You write content that real garden center customers would want to read and engage with.` 
          },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    // Validate content with more permissive rules
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
