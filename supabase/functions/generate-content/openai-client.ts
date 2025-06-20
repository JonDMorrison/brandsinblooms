
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 3) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Add progressively stricter instructions with each attempt, emphasizing paragraph formatting
    let enhancedPrompt = prompt;
    if (attempts > 1) {
      enhancedPrompt += `\n\n🚨 REGENERATION ATTEMPT ${attempts} - PREVIOUS ISSUES: ${lastIssues.join(', ')}
      
CRITICAL: The previous attempt had issues. You MUST:
- Write in natural, engaging language appropriate for ${contentType || 'content'}
- Use VERY SHORT paragraphs with frequent line breaks (1-2 sentences max for social media)
- NEVER use square brackets like [Company Name] or [Location] - use actual names or "we"/"our"
- Write like a professional garden center expert speaking to customers
- Format content for mobile readability with plenty of white space
- Add line breaks between different thoughts, tips, or key points
- Make content scannable and easy to read on mobile devices
      
IMMEDIATE REJECTION if content contains:
- Any text in square brackets [like this]
- Generic placeholders instead of specific names or "we"/"our" references
- Long paragraphs without line breaks (especially for Facebook - max 125 words total)
- Dense blocks of text that are hard to scan on mobile`;
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
            content: `You are a professional garden center content writer who creates engaging, well-formatted content optimized for mobile reading. 

CRITICAL FORMATTING RULES:
- Use VERY SHORT paragraphs - maximum 1-2 sentences per paragraph for social media, 2-3 for longer content
- Add line breaks between different thoughts, tips, or key points
- Format content for mobile scanning with plenty of white space
- Make content easily readable on smartphones
- Break up any long blocks of text into digestible chunks
- Use natural formatting including short paragraphs, bullet points, numbered lists, and emojis to improve readability and engagement
- NEVER use placeholders like [Company Name] - instead use specific names when provided or "we"/"our" for the business

CONTENT FORMATTING GUIDELINES BY TYPE:
- Facebook: Maximum 125 words, very short paragraphs (1-2 sentences), frequent line breaks
- Instagram: Short paragraphs with line breaks between key points
- Blog: Short paragraphs (2-3 sentences max) with clear section breaks
- Newsletter: Short paragraphs throughout with line breaks between topics
- Video: Short sentences with natural pauses and clear segment breaks

You write content that real garden center customers would want to read, share, and engage with on their mobile devices.` 
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
    
    // Validate content with enhanced rules including paragraph length
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
