
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 5) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Build enhanced prompt with quality guidelines integrated directly
    let qualityEnhancedPrompt = prompt;
    
    // Add comprehensive quality guidelines to the prompt
    qualityEnhancedPrompt += `\n\n🎯 CONTENT QUALITY REQUIREMENTS (MANDATORY):

WRITING STYLE GUIDELINES:
- Write in natural, conversational language using contractions ("you'll", "we're", "don't")
- Vary sentence length for natural rhythm (mix short punchy sentences with longer explanatory ones)
- Use specific plant names, gardening techniques, and sensory details
- Sound like a knowledgeable garden center expert talking to customers
- ABSOLUTELY NO emojis anywhere in the content
- NO corporate buzzwords ("leverage", "optimize", "maximize", "seamless", "synergy", "utilize")
- **CRITICAL: Follow proper sentence spacing - use EXACTLY TWO SPACES after every sentence ending (period, question mark, exclamation mark) before the next sentence begins**

CONTENT STRUCTURE REQUIREMENTS:
- Keep sentences under 20 words on average
- Break longer content into multiple paragraphs with double line breaks
- Use concrete, actionable advice rather than vague statements
- Include specific plant varieties, care techniques, and seasonal timing
- Address real gardening challenges customers face
- **MANDATORY: Every sentence must end with exactly two spaces before the next sentence starts**

FORBIDDEN LANGUAGE PATTERNS:
- Never use "hello fellow gardeners", "dear gardeners", "hey gardeners"
- Avoid "green thumbs" as a greeting or address
- No AI-like disclaimers or formal corporate language
- Don't use generic phrases without specific gardening context
- No placeholder text in square brackets [like this]

STORYTELLING APPROACH:
- Make the customer the hero of their garden story
- Identify specific plant problems they're experiencing
- Show empathy for their gardening frustrations
- Provide clear, actionable steps they can take
- Paint a vivid picture of their garden success

SPACING COMPLIANCE CHECK:
Before finalizing content, verify that EVERY sentence ending is followed by exactly two spaces.  This applies to all periods, question marks, and exclamation marks throughout the entire text.

${contentType?.toLowerCase() === 'instagram' ? `
INSTAGRAM SPECIFIC QUALITY RULES:
- 60-120 words maximum (strictly enforced)
- Start with an engaging hook about a gardening challenge or opportunity
- Include 2-3 specific actionable gardening tips
- End with a natural call-to-action to visit the garden center
- Include 6-8 relevant hashtags
- Structure with line breaks for easy mobile reading
- **CRITICAL: Maintain two-space sentence spacing throughout post and hashtags**` : ''}

${contentType?.toLowerCase() === 'facebook' ? `
FACEBOOK SPECIFIC QUALITY RULES:
- 100-200 words for optimal engagement
- Write in a community-focused, conversation-starting tone
- Include a question to encourage comments and engagement
- Share practical gardening knowledge people can use immediately
- Use storytelling to connect emotionally with gardeners
- **CRITICAL: Maintain two-space sentence spacing throughout entire post**` : ''}

QUALITY VALIDATION:
Your content will be evaluated for natural tone, specific gardening value, engagement potential, and proper spacing.  Content that sounds robotic, uses corporate language, lacks specific gardening advice, or has incorrect sentence spacing will be rejected.`;

    if (attempts > 1) {
      qualityEnhancedPrompt += `\n\n⚠️ REGENERATION ATTEMPT ${attempts} - PREVIOUS ISSUES: ${lastIssues.join(', ')}

CRITICAL FIXES NEEDED:
The previous attempt had quality issues. You MUST address these specific problems:
${lastIssues.map(issue => `- ${issue}`).join('\n')}

Apply ALL quality guidelines above more strictly. Focus on natural, conversational gardening expertise.`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a certified StoryBrand Guide and expert garden center marketing specialist. You create engaging, high-quality content that sounds natural and provides genuine gardening value. You follow quality guidelines strictly and never use emojis or corporate buzzwords. CRITICAL: You always use exactly two spaces after every sentence ending (period, question mark, exclamation mark) before starting the next sentence.'
          },
          {
            role: 'user',
            content: qualityEnhancedPrompt
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log(`Generated content attempt ${attempts}:`, content.substring(0, 200));
    
    // Validate the generated content
    const validation = validateContent(content, contentType);
    
    if (validation.isValid) {
      console.log(`Content validation passed on attempt ${attempts}`);
      return {
        content,
        attempts,
        issues: []
      };
    }
    
    lastIssues = validation.issues;
    console.log(`Content validation failed on attempt ${attempts}:`, validation.issues);
    
    // If we've reached max attempts, return the best content we have with basic cleanup
    if (attempts >= maxAttempts) {
      console.log(`Max attempts reached, applying basic cleanup`);
      const cleanedContent = attemptBasicCleanup(content);
      return {
        content: cleanedContent,
        attempts,
        issues: validation.issues
      };
    }
  }
  
  // Fallback (should not reach here)
  return {
    content: '',
    attempts: maxAttempts,
    issues: ['Failed to generate content after maximum attempts']
  };
}

// Basic cleanup function to fix common issues
function attemptBasicCleanup(content: string): string {
  let cleaned = content;
  
  // Remove any remaining placeholder patterns
  cleaned = cleaned.replace(/\[company\s*name\]/gi, 'we');
  cleaned = cleaned.replace(/\[garden\s*center\s*name\]/gi, 'our garden center');
  cleaned = cleaned.replace(/\[business\s*name\]/gi, 'our business');
  cleaned = cleaned.replace(/your\s*garden\s*center(?!\s+name)/gi, 'our garden center');
  cleaned = cleaned.replace(/\[region\]/gi, 'your area');
  cleaned = cleaned.replace(/\[location\]/gi, 'your area');
  cleaned = cleaned.replace(/\[garden\s*center\s*location\]/gi, 'your area');
  
  // Remove any emojis that might have slipped through
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  
  // Fix sentence spacing - ensure exactly two spaces after sentence endings
  cleaned = cleaned.replace(/([.!?])\s+([A-Z])/g, '$1  $2');
  
  return cleaned.trim();
}
