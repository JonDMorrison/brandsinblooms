
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, maxAttempts: number = 5) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Add progressively stricter instructions with each attempt
    let enhancedPrompt = prompt;
    if (attempts > 1) {
      enhancedPrompt += `\n\n🚨 REGENERATION ATTEMPT ${attempts} - PREVIOUS FAILURES: ${lastIssues.join(', ')}
      
CRITICAL: The previous attempt was REJECTED for violating content rules. You MUST:
- Write in PLAIN ENGLISH only - no formatting, no code, no placeholders
- Use SHORT PARAGRAPHS (2-3 sentences max)
- NEVER use square brackets like [Company Name] or [Location]
- Write like a human speaking naturally to another human
- NO technical formatting whatsoever
      
IMMEDIATE REJECTION if content contains:
- Any text in square brackets [like this]
- Bullet points, numbered lists, or markdown
- Code formatting or technical language
- Generic placeholders instead of specific names`;
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
            content: `You are a professional garden center content writer who writes in plain, conversational English. You NEVER use placeholders, formatting, or technical language. You write like a friendly local expert talking to customers.

CRITICAL RULES (VIOLATION = CONTENT REJECTION):
1. Write in natural, flowing paragraphs only
2. Use specific company names, never placeholders like [Company Name]
3. Keep paragraphs short (2-3 sentences) for mobile reading
4. No formatting: no bold, italic, bullets, numbers, or code blocks
5. Sound conversational and authentic, not corporate or technical

You must write content that sounds like it came from a real person at a real garden center talking to real customers.` 
          },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    // Validate content
    const validation = validateContent(generatedContent);
    
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
