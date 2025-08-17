import { ContentBlock } from '@/types/emailBuilder';

// Post type rotation for varied content styles
const POST_TYPE_ROTATION = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

// Subtopic mapping for content variety
const getSubtopicForBlock = (campaignTitle: string, blockIndex: number): string => {
  const baseTheme = campaignTitle.replace(/Newsletter$/i, '').trim();
  
  // Define subtopics based on theme patterns
  const subtopicMappings: Record<string, string[]> = {
    'bee': [
      'Bee-friendly garden plants and flowers',
      'Supporting local beekeepers and honey',
      'Creating pollinator habitats in small spaces',
      'DIY bee house construction guide',
      'Weekly bee conservation tips'
    ],
    'spring': [
      'Early spring planting essentials',
      'Soil preparation and testing',
      'Starting seedlings indoors',
      'Spring garden cleanup tips',
      'Spring fertilizing schedule'
    ],
    'summer': [
      'Heat-tolerant plants for summer',
      'Watering strategies for hot weather',
      'Summer pest management',
      'Harvesting summer vegetables',
      'Summer garden maintenance'
    ],
    'fall': [
      'Fall planting opportunities and timing',
      'Preparing gardens for winter dormancy',
      'Fall harvest and preservation techniques',
      'Seasonal color plants and decorating',
      'Fall garden cleanup and maintenance',
      'Bulb planting for spring blooms',
      'Winterizing garden tools and equipment',
      'Fall fertilizing and soil preparation'
    ],
    'winter': [
      'Winter garden protection',
      'Indoor gardening projects',
      'Planning next year\'s garden',
      'Winter plant care',
      'Holiday decorating with plants'
    ]
  };

  // Find matching theme
  const theme = Object.keys(subtopicMappings).find(key => 
    baseTheme.toLowerCase().includes(key)
  );
  
  if (theme && subtopicMappings[theme]) {
    return subtopicMappings[theme][blockIndex % subtopicMappings[theme].length];
  }
  
  // Generic fallback subtopics
  const genericSubtopics = [
    'Featured plant spotlight',
    'Garden care essentials',
    'Seasonal gardening tips',
    'Problem-solving solutions',
    'Community gardening updates'
  ];
  
  return genericSubtopics[blockIndex % genericSubtopics.length];
};

// Enhanced block prompt creation with post-type variety and cross-block awareness
export const createBlockPrompt = (
  block: ContentBlock, 
  campaignTitle: string, 
  campaignDescription: string, 
  blockIndex: number,
  previousBlocks: ContentBlock[] = [],
  totalBlocks: number = 1
): string => {
  const postType = POST_TYPE_ROTATION[blockIndex % POST_TYPE_ROTATION.length];
  const subtopic = getSubtopicForBlock(campaignTitle, blockIndex);
  
  const baseTheme = campaignTitle.replace(/Newsletter$/i, '').trim();
  
  const postTypeInstructions = {
    'instagram': 'Visual, engaging content with hashtag-friendly style. Use short paragraphs, compelling visuals, and social media tone.',
    'facebook': 'Community-focused, conversational content that encourages engagement. Use a friendly, approachable tone.',
    'blog': 'Educational, detailed content with how-to format. Use informative headlines and structured content.',
    'video': 'Step-by-step instructional content. Use clear, actionable language and sequential formatting.',
    'newsletter': 'Summary/tips format with clear CTAs. Use professional newsletter tone with value-driven content.'
  };
  
  const blockTypeContext = {
    'image-text': 'featured content section with compelling headline and engaging description',
    'text': 'informative content section with valuable insights',
    'button': 'call-to-action section with motivating copy',
    'quote': 'inspirational quote or testimonial section',
    'divider': 'section divider or spacer',
    'header': 'header section with campaign title'
  };

  const context = blockTypeContext[block.type] || 'content section';
  
  // Build previous blocks context for differentiation
  const buildPreviousContext = (): string => {
    if (previousBlocks.length === 0) {
      return '\nNARRATIVE POSITION: This is the first content block. Set the tone and introduce the main theme.';
    }
    
    const previousContent = previousBlocks
      .map((b, idx) => `Block ${idx + 1}: "${b.title || b.headline || 'Untitled'}" - focuses on ${(b.content || b.body || '').substring(0, 100)}`)
      .join('\n');
    
    return `
PREVIOUS BLOCKS COVERED:
${previousContent}

DIFFERENTIATION REQUIREMENTS:
- This block MUST focus on a completely different aspect: ${subtopic}
- Avoid repeating any topics or approaches from previous blocks
- Position: ${blockIndex + 1} of ${totalBlocks} (${blockIndex === 0 ? 'opening' : blockIndex === totalBlocks - 1 ? 'closing' : 'middle'})`;
  };
  
  return `Create ${context} for a "${campaignTitle}" newsletter with ${postType} content style.
    
    PRIMARY THEME: ${baseTheme}
    SPECIFIC SUBTOPIC: ${subtopic}
    CONTENT STYLE: ${postType}
    STYLE INSTRUCTIONS: ${postTypeInstructions[postType]}
    
    Block type: ${block.type}
    Block position: ${blockIndex + 1}
    ${buildPreviousContext()}
    
    CONTENT VARIETY REQUIREMENTS:
    - STRICTLY AVOID these overused openings: "As the [season]...", "It's time to...", "Perfect time to...", "[Season] is here...", "Now is the time..."
    - Use the ${postType} content style and tone throughout
    - Focus ONLY on the specific subtopic: ${subtopic}
    - This block must cover COMPLETELY DIFFERENT aspects than other blocks in the campaign
    - Start with a unique, compelling hook that hasn't been used before
    - Serve the appropriate narrative purpose: ${blockIndex === 0 ? 'Introduction & theme setup' : blockIndex < totalBlocks - 1 ? 'Development & specific insights' : 'Conclusion & strong call-to-action'}
    
    FORMATTING FOR ${postType.toUpperCase()}:
    ${postTypeInstructions[postType]}
    
    Write engaging, actionable content that would interest garden center customers.
    Make this content specifically about ${subtopic} within the broader ${baseTheme} theme.
    
    IMPORTANT: Return ONLY a JSON object with keys: title, content, cta_text, cta_url.
    Do not use markdown code fences, backticks, or any additional text outside the JSON.`;
};