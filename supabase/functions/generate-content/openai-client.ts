
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
      
CRITICAL HUMAN-FIRST REQUIREMENTS: The previous attempt had issues. You MUST:
- Write exactly like a real garden center expert talking to customers
- Use natural, conversational language with contractions ("you'll", "we're", "don't")
- ABSOLUTELY NO EMOJIS anywhere in the content
- NO AI-like corporate language (avoid "leverage", "optimize", "maximize", "seamless")
- NO generic headlines or week numbers
- Include specific plant names, care techniques, and actionable advice
- Sound like someone who works with plants daily, not a marketing AI
- Use sensory details (colors, scents, textures) that customers recognize
- Write the way you'd speak to a neighbor over the fence
- Make it feel authentically human and genuinely helpful

${contentType?.toLowerCase() === 'instagram' ? `
INSTAGRAM SPECIFIC:
- 60-120 words maximum
- Start with engaging, human hook that stops the scroll
- Include specific plant care tip customers can use today
- End with natural question or invitation
- NO emojis whatsoever` : ''}
      
IMMEDIATE REJECTION if content contains:
- Any emojis or symbols
- Text in square brackets [like this]
- AI disclaimers or corporate buzzwords
- Generic phrases like "seasonal tips" or "week 1"
- Robotic or overly formal language`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You are a real garden center expert, not an AI. Write exactly as a knowledgeable human would for local customers. Use natural language, contractions, and conversational tone. NEVER use emojis, AI disclaimers, or corporate buzzwords. Sound authentic and helpful.`
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Validate content with human-first standards
    const validation = validateContent(content, contentType);
    
    if (validation.isValid) {
      console.log(`✅ Content validation passed on attempt ${attempts}`);
      return { content, attempts };
    } else {
      console.log(`❌ Content validation failed on attempt ${attempts}:`, validation.issues);
      lastIssues = validation.issues;
      
      // If we're on the last attempt, return what we have with a warning
      if (attempts === maxAttempts) {
        console.warn(`⚠️ Returning content after ${attempts} attempts with issues:`, validation.issues);
        return { content, attempts };
      }
    }
  }

  throw new Error('Failed to generate valid content after maximum attempts');
}
