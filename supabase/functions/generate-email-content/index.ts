import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      prompt, 
      persona, 
      type, 
      personas = [], 
      postType,
      campaignTitle = '',
      campaignContext = '',
      blockIndex = 0,
      previousBlocks = [],
      totalBlocks = 1
    } = await req.json();

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Format personas for prompt context
    const formatPersonasForPrompt = (personas: any[]): string => {
      if (!personas || personas.length === 0) {
        return "general garden center customers interested in plants, gardening supplies, and outdoor living";
      }
      const personaNames = personas.map(p => p.persona_name || p.name);
      if (personaNames.length === 1) return personaNames[0];
      if (personaNames.length === 2) return `${personaNames[0]} and ${personaNames[1]}`;
      const allButLast = personaNames.slice(0, -1).join(", ");
      return `${allButLast}, and ${personaNames[personaNames.length - 1]}`;
    };

    const formattedPersonas = formatPersonasForPrompt(personas);

    // Get persona details if provided (legacy support)
    let personaContext = '';
    if (persona) {
      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('name', persona)
        .single();
      
      if (personaData) {
        personaContext = `
        Write in the tone and style for "${personaData.name}": ${personaData.description}
        Tone: ${personaData.tone}
        Sample phrases: ${personaData.sample_phrases?.join(', ')}
        Buying triggers: ${personaData.buying_triggers?.join(', ')}
        `;
      }
    }

    // Add persona context for new personas array
    const personaInsights = personas.length > 0 ? 
      `\n\nAudience insights: This campaign is targeted toward the following customer personas: ${formattedPersonas}. Write with empathy and clarity to resonate with these profiles. Ensure relevance, tone, and examples match their goals and challenges.` : 
      personaContext;

    // Create campaign context for enhanced prompts
    const getCampaignSpecificContext = (title: string): string => {
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('hydrangea')) {
        const hydrangeaSubtopics = [
          'August planting and site selection for hydrangeas',
          'Soil pH testing and color management techniques', 
          'Late summer pruning guidelines by hydrangea type',
          'Watering and fertilizing during August heat',
          'Preparing hydrangeas for fall blooming season'
        ];
        const subtopic = hydrangeaSubtopics[blockIndex % hydrangeaSubtopics.length];
        
        return `
CAMPAIGN FOCUS: August Hydrangea Care Month
SPECIFIC SUBTOPIC: ${subtopic}
CONTEXT: This is block ${blockIndex + 1} of ${totalBlocks} in a cohesive newsletter about hydrangea care in August.

KEY INFORMATION FOR AUGUST HYDRANGEAS:
- Peak deadheading and pruning time
- Color management through soil pH (acidic = blue, alkaline = pink)
- Heat stress prevention and proper watering
- Late summer feeding for next year's blooms
- Variety selection for different garden zones`;
      }
      
      if (lowerTitle.includes('rose')) {
        const roseSubtopics = [
          'August rose care and disease prevention',
          'Late summer pruning and deadheading techniques',
          'Rose varieties for continuous blooming',
          'Soil preparation for fall rose planting'
        ];
        const subtopic = roseSubtopics[blockIndex % roseSubtopics.length];
        return `
CAMPAIGN FOCUS: Rose Care and Management
SPECIFIC SUBTOPIC: ${subtopic}
CONTEXT: This is block ${blockIndex + 1} of ${totalBlocks} focusing on roses.`;
      }
      
      return `
CAMPAIGN FOCUS: ${title}
CONTEXT: This is block ${blockIndex + 1} of ${totalBlocks} in the campaign.
${campaignContext ? `ADDITIONAL CONTEXT: ${campaignContext}` : ''}`;
    };

    // Build narrative context from previous blocks
    const getPreviousBlocksContext = (): string => {
      if (!previousBlocks || previousBlocks.length === 0) {
        return '';
      }
      
      const previousContent = previousBlocks
        .map((block, idx) => `Block ${idx + 1}: ${block.title || 'Untitled'} - ${(block.content || block.body || '').substring(0, 100)}...`)
        .join('\n');
      
      return `
PREVIOUS BLOCKS IN THIS NEWSLETTER:
${previousContent}

NARRATIVE FLOW REQUIREMENT: Build upon the previous content to create a cohesive story. Avoid repeating information already covered. Each block should add new value while maintaining thematic consistency.`;
    };

    const campaignSpecificContext = getCampaignSpecificContext(campaignTitle);
    const narrativeContext = getPreviousBlocksContext();

    // Get post-type specific instructions
    const getPostTypeInstructions = (postType: string): string => {
      const instructions = {
        'instagram': 'Visual, engaging content with hashtag-friendly style. Use short paragraphs, compelling visuals, and social media tone. Keep content punchy and engaging.',
        'facebook': 'Community-focused, conversational content that encourages engagement. Use a friendly, approachable tone that invites discussion.',
        'blog': 'Educational, detailed content with how-to format. Use informative headlines, structured content, and value-driven approach.',
        'video': 'Step-by-step instructional content. Use clear, actionable language and sequential formatting that works for video narration.',
        'newsletter': 'Summary/tips format with clear CTAs. Use professional newsletter tone with value-driven content and clear next steps.'
      };
      return instructions[postType] || instructions['newsletter'];
    };

    // Create system prompt based on type and post type
    const systemPrompt = type === 'email_block' 
      ? `You are an expert email marketing copywriter specializing in garden and plant content. 
         Create compelling, actionable email content blocks that drive engagement and conversions.
         ${personaInsights}
         
         ${campaignSpecificContext}
         ${narrativeContext}
         
         ${postType ? `CONTENT STYLE: ${postType.toUpperCase()}
         STYLE INSTRUCTIONS: ${getPostTypeInstructions(postType)}
         
         CRITICAL: Write in the ${postType} content style throughout. This affects tone, structure, and formatting.` : ''}
         
         CONTENT REQUIREMENTS:
         - Mention specific plant varieties, techniques, or products when relevant
         - Include actionable advice readers can implement immediately  
         - Use seasonal timing and urgency appropriate for the current context
         - Avoid generic phrases like "latest updates" or "this week's newsletter"
         - Each block must add unique value and avoid repetition with previous blocks
         - Maintain consistent voice and expertise throughout the campaign
         
         Return your response as JSON with these fields:
         - title: A compelling, specific headline (max 60 characters) that mentions the key topic
         - content: Main body content (2-3 paragraphs, engaging and informative with specific details)
         - cta_text: Call-to-action button text (max 25 characters)
         - cta_url: Suggested URL path (can be placeholder like "/shop/hydrangeas" or "/care-guides")
         
         Make it conversion-focused, seasonally appropriate, and valuable to garden enthusiasts.`
      : `You are a helpful content generator. Create content based on the user's request.${personaInsights}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    // Try to parse as JSON, fallback to plain text
    let result;
    try {
      result = JSON.parse(generatedText);
    } catch {
      // If not JSON, create structured response
      result = {
        title: 'AI Generated Content',
        content: generatedText,
        cta_text: 'Learn More',
        cta_url: '#'
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-email-content function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      title: 'Error',
      content: 'Sorry, there was an error generating content. Please try again.',
      cta_text: 'Try Again',
      cta_url: '#'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});