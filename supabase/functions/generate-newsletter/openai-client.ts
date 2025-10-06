
import { validateAndLogQuery, getImageQueryPromptInstructions } from "../_shared/unsplash-keyword-validator.ts";

export const generateNewsletterWithOpenAI = async (
  openAIApiKey: string,
  prompt: string
): Promise<string> => {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('Generating StoryBrand newsletter with enhanced validation and NO week references');

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Newsletter generation attempt ${attempts}/${maxAttempts}`);

    // Add progressively stricter instructions with each attempt
    let enhancedPrompt = prompt;
    if (attempts > 1) {
      enhancedPrompt += `\n\n🚨 REGENERATION ATTEMPT ${attempts} - CRITICAL REQUIREMENTS:

STORYBRAND FRAMEWORK ENFORCEMENT:
- You MUST follow the StoryBrand framework exactly: Character → Problem → Guide → Plan → CTA → Success
- Position the gardener as the CHARACTER/hero facing seasonal challenges
- Identify both external PROBLEMS (plant issues) and internal desires (garden success)
- Show the garden center as the trusted GUIDE with empathy + expertise
- Provide a clear action PLAN in flowing paragraphs (NO lists)
- Include a direct CALL TO ACTION to visit the garden center
- Paint a vivid SUCCESS picture of their thriving garden

ABSOLUTE CONTENT PROHIBITIONS:
- NO week numbers anywhere (Week 1, Week 26, "weekly", "this week", etc.)
- NO generic openings ("Welcome to", "This week in", etc.)
- NO bullet points (•) or numbered lists (1., 2., 3.)
- NO "Green Thumbs" phrase or variations
- NO emojis anywhere in the content
- NO AI disclaimers or corporate buzzwords

REQUIRED CONTENT STRUCTURE:
- START with compelling seasonal hook or gardening challenge
- WRITE in flowing paragraphs only - never use lists
- INCLUDE specific plant names and sensory garden details
- SOUND like a knowledgeable local garden expert
- END with clear invitation to visit the garden center

${getImageQueryPromptInstructions()}

IMMEDIATE REJECTION if content contains:
- Any week number references
- Bullet points or numbered lists
- Generic "Welcome" openings
- Missing StoryBrand elements
- Missing imageQuery field`;
    } else {
      // Add image query instructions to first attempt
      enhancedPrompt += `\n\n${getImageQueryPromptInstructions()}`;
    }

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
            content: `You are a certified StoryBrand Guide specializing in garden center communications. You MUST create newsletters that follow the StoryBrand framework precisely: Character → Problem → Guide → Plan → CTA → Success. Write naturally flowing paragraphs without any lists, bullet points, or numbered items. Never use week numbers or generic openings. Position customers as heroes of their garden story with the garden center as their trusted guide. Always respond with valid JSON including both "content", "subject", and "imageQuery" fields.` 
          },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Validate the generated content
    const validation = validateNewsletterContent(content);
    
    if (validation.isValid) {
      console.log(`✅ Newsletter validation passed on attempt ${attempts}`);
      
      // Extract and validate image query if present
      try {
        const parsed = JSON.parse(content);
        if (parsed.imageQuery) {
          parsed.imageQuery = validateAndLogQuery(parsed.imageQuery, 'Newsletter');
          return JSON.stringify(parsed);
        }
      } catch {
        // If parsing fails, just return content as-is
      }
      
      return content;
    } else {
      console.log(`❌ Newsletter validation failed on attempt ${attempts}:`, validation.issues);
      
      // If we're on the last attempt, return what we have with a warning
      if (attempts === maxAttempts) {
        console.warn(`⚠️ Returning newsletter after ${attempts} attempts with issues:`, validation.issues);
        
        // Try to add default image query if missing
        try {
          const parsed = JSON.parse(content);
          if (!parsed.imageQuery) {
            parsed.imageQuery = 'garden center seasonal newsletter';
          }
          return JSON.stringify(parsed);
        } catch {
          return content;
        }
      }
    }
  }

  throw new Error('Failed to generate valid StoryBrand newsletter after maximum attempts');
};

function validateNewsletterContent(content: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  try {
    const parsed = JSON.parse(content);
    const newsletterContent = parsed.content || '';
    const subject = parsed.subject || '';
    
    // Check for week references
    const weekPatterns = [
      /week\s*\d+/gi,
      /weekly/gi,
      /this week/gi,
      /week\s+of/gi
    ];
    
    weekPatterns.forEach(pattern => {
      if (pattern.test(newsletterContent) || pattern.test(subject)) {
        issues.push('Content contains week number references');
      }
    });
    
    // Check for generic openings
    const genericPatterns = [
      /welcome to/gi,
      /this week in/gi,
      /week.*in review/gi
    ];
    
    genericPatterns.forEach(pattern => {
      if (pattern.test(newsletterContent)) {
        issues.push('Content uses generic opening phrases');
      }
    });
    
    // Check for bullet points and lists
    const listPatterns = [
      /•/g,
      /^\s*\d+\./gm,
      /^\s*-\s/gm
    ];
    
    listPatterns.forEach(pattern => {
      if (pattern.test(newsletterContent)) {
        issues.push('Content contains bullet points or numbered lists');
      }
    });
    
    // Check for emojis
    const emojiRegex = /[\p{Emoji}]/u;
    if (emojiRegex.test(newsletterContent) || emojiRegex.test(subject)) {
      issues.push('Content contains emojis');
    }
    
    // Check for Green Thumbs phrase
    if (/green\s*thumbs?/gi.test(newsletterContent) || /green\s*thumbs?/gi.test(subject)) {
      issues.push('Content contains forbidden "Green Thumbs" phrase');
    }
    
    // Check for StoryBrand elements
    const contentLower = newsletterContent.toLowerCase();
    
    // Character focus
    if (!/(you|your|gardener)/i.test(newsletterContent)) {
      issues.push('Missing character focus (customer as hero)');
    }
    
    // Problem identification
    if (!/(problem|challenge|struggle|difficult|frustrat)/i.test(newsletterContent)) {
      issues.push('Missing problem identification');
    }
    
    // Guide positioning
    if (!/(expert|experience|help|understand|know|guide)/i.test(newsletterContent)) {
      issues.push('Missing guide positioning');
    }
    
    // Call to action
    if (!/(visit|come|stop by|see us|contact)/i.test(newsletterContent)) {
      issues.push('Missing clear call to action');
    }
    
    // Success visualization
    if (!/(beautiful|thrive|bloom|flourish|success|gorgeous)/i.test(newsletterContent)) {
      issues.push('Missing success visualization');
    }
    
  } catch (parseError) {
    issues.push('Invalid JSON response format');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
