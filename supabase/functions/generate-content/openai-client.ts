
import { validateContent } from './validation.ts';
import { sanitizeWeekNumbers, validateNoWeekNumbers } from './week-sanitizer.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 3) {
  console.log(`🚀 OPTIMIZED: Starting content generation with max ${maxAttempts} attempts`);
  
  // Create parallel validation attempts for faster processing
  const validationPromises = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    validationPromises.push(generateSingleAttempt(prompt, openAIApiKey, contentType, attempt));
  }
  
  // Run attempts in parallel and return first valid result
  const results = await Promise.allSettled(validationPromises);
  
  // Find first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.isValid) {
      console.log(`✅ OPTIMIZED: Found valid content on parallel attempt`);
      return {
        content: result.value.content,
        attempts: 1, // Parallel processing
        issues: []
      };
    }
  }
  
  // If no valid result found, use the best available content
  const bestResult = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => a.issues.length - b.issues.length)[0];
  
  if (bestResult) {
    console.log(`⚠️ OPTIMIZED: Using best available content with issues:`, bestResult.issues);
    const cleanedContent = attemptBasicCleanup(bestResult.content);
    return {
      content: cleanedContent,
      attempts: maxAttempts,
      issues: bestResult.issues
    };
  }
  
  // Fallback
  return {
    content: '',
    attempts: maxAttempts,
    issues: ['Failed to generate content after parallel attempts']
  };
}

async function generateSingleAttempt(prompt: string, openAIApiKey: string, contentType?: string, attemptNumber: number) {
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
- **NO HASHTAGS** - Content should be clean and professional without hashtag clusters
- **NO IMAGE RECOMMENDATIONS** - Never include bracketed image descriptions like "[Image: ...]"
- NO corporate buzzwords ("leverage", "optimize", "maximize", "seamless", "synergy", "utilize")
- **CRITICAL: Follow proper sentence spacing - use EXACTLY TWO SPACES after every sentence ending (period, question mark, exclamation mark) before the next sentence begins**

CONTENT STRUCTURE REQUIREMENTS:
- Keep sentences under 20 words on average
- Break longer content into SHORT paragraphs (2-3 sentences maximum)
- Use double line breaks between paragraphs for readability
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
- **NO HASHTAGS** - Keep content clean and professional
- **NO EMOJIS** - Use descriptive words instead
- **NO IMAGE SUGGESTIONS** - Never include "[Image: ...]" descriptions
- Structure with line breaks for easy mobile reading
- Short paragraphs (2-3 sentences maximum)
- **CRITICAL: Maintain two-space sentence spacing throughout post**` : ''}

${contentType?.toLowerCase() === 'facebook' ? `
FACEBOOK SPECIFIC QUALITY RULES:
- 100-200 words for optimal engagement
- Write in a community-focused, conversation-starting tone
- Include a question to encourage comments and engagement
- Share practical gardening knowledge people can use immediately
- Use storytelling to connect emotionally with gardeners
- **CRITICAL: Maintain two-space sentence spacing throughout entire post**` : ''}

QUALITY VALIDATION:
Your content will be evaluated for natural tone, specific gardening value, engagement potential, and proper spacing.  Content that sounds robotic, uses corporate language, lacks specific gardening advice, or has incorrect sentence spacing will be rejected.

${contentType?.toLowerCase() === 'blog' ? `
BLOG CONTENT CRITICAL REQUIREMENTS:
- MANDATORY: Output must be properly structured HTML using semantic tags
- Use <h2> for section headings, <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis
- NEVER use markdown syntax (no #, ##, *, -, etc.)
- Each section should be wrapped in appropriate HTML tags
- Content will be rejected if it contains any markdown formatting
- Follow the exact HTML structure specified in the prompt guidelines` : ''}`;

    if (attemptNumber > 1) {
      qualityEnhancedPrompt += `\n\n⚠️ PARALLEL ATTEMPT ${attemptNumber} - Focus on high quality from start

CRITICAL REQUIREMENTS:
Apply ALL quality guidelines above strictly. Focus on natural, conversational gardening expertise with proper spacing.`;
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
            content: `You are a certified StoryBrand Guide and expert garden center marketing specialist. You create engaging, high-quality content that sounds natural and provides genuine gardening value. You follow quality guidelines strictly and never use emojis or corporate buzzwords. CRITICAL: You always use exactly two spaces after every sentence ending (period, question mark, exclamation mark) before starting the next sentence. ${contentType?.toLowerCase() === 'blog' ? 'CRITICAL FOR BLOG CONTENT: You MUST output properly structured HTML using semantic tags like <h2>, <p>, <ul>, <li>, and <strong>. NEVER use markdown syntax like # or ## or * or - for formatting. Always use HTML tags.' : ''}`
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
    let content = data.choices[0].message.content;
    
    // CRITICAL: Sanitize week numbers from generated content
    content = sanitizeWeekNumbers(content);
    
    console.log(`Generated content attempt ${attemptNumber}:`, content.substring(0, 200));
    
    // Validate the generated content (including week number check)
    const validation = validateContent(content, contentType);
    const weekValidation = validateNoWeekNumbers(content);
    
    // Combine all validation issues
    const allIssues = [...validation.issues];
    if (!weekValidation.isValid) {
      allIssues.push(...weekValidation.issues);
    }
    
    return {
      content,
      isValid: validation.isValid && weekValidation.isValid,
      issues: allIssues
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
  
  // CRITICAL: Remove any week number references that slipped through
  cleaned = sanitizeWeekNumbers(cleaned);
  
  // Fix sentence spacing - ensure exactly two spaces after sentence endings
  cleaned = cleaned.replace(/([.!?])\s+([A-Z])/g, '$1  $2');
  
  return cleaned.trim();
}
