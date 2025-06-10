
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, maxAttempts: number = 3) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
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
            content: 'You are a professional content writer specializing in garden center marketing with deep knowledge of regional gardening differences. Create authentic, personalized content that reflects the specific company\'s brand and local region. CRITICAL RULES: ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation. ABSOLUTELY NEVER use bullet points, numbered lists, or dashes. ABSOLUTELY NEVER start with "Welcome to" or mention week numbers. ABSOLUTELY NEVER use emojis. Write only in flowing paragraphs.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
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
    
    if (attempts < maxAttempts) {
      // Add validation feedback to prompt for next attempt
      prompt += `\n\nIMPORTANT: The previous attempt failed validation due to: ${validation.issues.join(', ')}. Please ensure you avoid these issues completely.`;
    }
  }
  
  console.log(`Content generation failed after ${attempts} attempts. Last issues:`, lastIssues);
  throw new Error(`Content generation failed validation after ${attempts} attempts: ${lastIssues.join(', ')}`);
}
