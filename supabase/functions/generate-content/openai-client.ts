
import { validateContent } from './validation.ts';

export async function generateContentWithValidation(prompt: string, openAIApiKey: string, contentType?: string, maxAttempts: number = 5) {
  let attempts = 0;
  let lastIssues: string[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Add progressively stricter StoryBrand instructions with each attempt
    let enhancedPrompt = prompt;
    if (attempts > 1) {
      enhancedPrompt += `\n\n🚨 REGENERATION ATTEMPT ${attempts} - PREVIOUS ISSUES: ${lastIssues.join(', ')}
      
CRITICAL STORYBRAND REQUIREMENTS: The previous attempt had issues. You MUST:
- Follow the StoryBrand framework exactly: Character → Problem → Guide → Plan → CTA → Success
- Write exactly like a certified StoryBrand Guide would for a garden center
- Use natural, conversational language with contractions ("you'll", "we're", "don't")
- ABSOLUTELY NO EMOJIS anywhere in the content
- NO AI-like corporate language (avoid "leverage", "optimize", "maximize", "seamless")
- Include specific plant names, care techniques, and actionable advice
- Sound like a knowledgeable garden center expert talking to customers
- Use sensory details (colors, scents, textures) that gardeners recognize
- Make the customer the hero of their garden story
- Position the garden center as the trusted guide
- Paint a vivid picture of garden success

${contentType?.toLowerCase() === 'instagram' ? `
INSTAGRAM STORYBRAND SPECIFIC:
- 60-120 words maximum
- Start with the gardener's challenge or seasonal opportunity (Character)
- Name the plant problem + internal frustration (Problem)
- Show garden center empathy + expertise (Guide)
- Give 2-3 specific plant care steps (Plan)
- Natural invitation to visit (CTA)
- Describe beautiful garden outcome (Success)
- NO emojis whatsoever` : ''}
      
IMMEDIATE REJECTION if content contains:
- Any emojis or symbols
- Text in square brackets [like this] 
- AI disclaimers or corporate buzzwords
- Generic phrases without StoryBrand structure
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
            content: `You are a certified StoryBrand Guide and garden center marketing expert. Write exactly as a knowledgeable human would for local gardening customers. Use natural language, contractions, and conversational tone. NEVER use emojis, AI disclaimers, or corporate buzzwords. Follow the StoryBrand framework precisely: Character → Problem → Guide → Plan → CTA → Success. Sound authentic and helpful with specific plant care expertise.`
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
    
    // Validate content with StoryBrand standards
    const validation = validateStoryBrandContent(content, contentType);
    
    if (validation.isValid) {
      console.log(`✅ StoryBrand content validation passed on attempt ${attempts}`);
      return { content, attempts };
    } else {
      console.log(`❌ StoryBrand content validation failed on attempt ${attempts}:`, validation.issues);
      lastIssues = validation.issues;
      
      // If we're on the last attempt, return what we have with a warning
      if (attempts === maxAttempts) {
        console.warn(`⚠️ Returning content after ${attempts} attempts with issues:`, validation.issues);
        return { content, attempts };
      }
    }
  }

  throw new Error('Failed to generate valid StoryBrand content after maximum attempts');
}

function validateStoryBrandContent(content: string, contentType?: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const contentLower = content.toLowerCase();
  
  // Check for emojis (critical StoryBrand requirement)
  const emojiRegex = /[\p{Emoji}]/u;
  if (emojiRegex.test(content)) {
    issues.push('Content contains emojis - not allowed in StoryBrand content');
  }
  
  // Check for AI-like language
  const corporateWords = ['leverage', 'optimize', 'maximize', 'seamless', 'synergy', 'utilize'];
  const hasCorporateLanguage = corporateWords.some(word => contentLower.includes(word));
  if (hasCorporateLanguage) {
    issues.push('Content uses corporate buzzwords instead of natural language');
  }
  
  // Check for StoryBrand elements
  const hasCharacterFocus = /you|your|gardener|garden/i.test(content);
  if (!hasCharacterFocus) {
    issues.push('Content should focus on the gardener as the character/hero');
  }
  
  // Check for problem identification
  const problemWords = ['struggle', 'challenge', 'difficult', 'frustrat', 'problem', 'issue', 'trouble'];
  const hasProblem = problemWords.some(word => contentLower.includes(word));
  if (!hasProblem) {
    issues.push('Content should identify gardening problems or challenges');
  }
  
  // Check for guide positioning (expertise/empathy)
  const guideWords = ['expert', 'experience', 'help', 'guide', 'understand', 'know', 'years'];
  const hasGuide = guideWords.some(word => contentLower.includes(word));
  if (!hasGuide) {
    issues.push('Content should position garden center as trusted guide');
  }
  
  // Check for actionable plan
  const planWords = ['step', 'first', 'then', 'next', 'start', 'begin', 'follow'];
  const hasPlan = planWords.some(word => contentLower.includes(word));
  if (!hasPlan) {
    issues.push('Content should include clear action steps or plan');
  }
  
  // Check for call to action
  const ctaWords = ['visit', 'come', 'stop by', 'call', 'contact', 'see us', 'drop by'];
  const hasCTA = ctaWords.some(word => contentLower.includes(word));
  if (!hasCTA) {
    issues.push('Content should include clear call to action');
  }
  
  // Check for success visualization
  const successWords = ['beautiful', 'thriv', 'bloom', 'flourish', 'success', 'gorgeous', 'stunning'];
  const hasSuccess = successWords.some(word => contentLower.includes(word));
  if (!hasSuccess) {
    issues.push('Content should paint picture of successful outcome');
  }
  
  // Check for specific plant care advice
  const careWords = ['water', 'fertiliz', 'prune', 'plant', 'soil', 'seed', 'bloom', 'grow'];
  const hasCareAdvice = careWords.some(word => contentLower.includes(word));
  if (!hasCareAdvice) {
    issues.push('Content should include specific plant care advice');
  }
  
  // Content type specific validations
  if (contentType?.toLowerCase() === 'instagram') {
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 130) {
      issues.push('Instagram content exceeds 120 word limit');
    }
    if (wordCount < 50) {
      issues.push('Instagram content too short - needs more substance');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
