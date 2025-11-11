import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TagGenerationRequest {
  contentContext: string;
  contentTitle?: string;
  channel: string;
}

interface GeneratedTag {
  name: string;
  category: 'subject' | 'color' | 'season' | 'mood' | 'style' | 'activity' | 'setting';
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const body: TagGenerationRequest = await req.json();
    const { contentContext, contentTitle = '', channel } = body;

    console.log('🏷️ Generating tags for image...', { channel, contextLength: contentContext.length });

    // Call OpenAI to generate comprehensive tags
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert image tagging AI for a garden center marketing system.
Generate 10-15 comprehensive, searchable tags based on the content context provided.

Categories (you MUST use these exact category names):
- subject: Main subjects (plants, flowers, tools, garden features)
- color: Dominant colors (vibrant, pastel, green, red, etc.)
- season: Seasonal context (spring, summer, fall, winter)
- mood: Emotional tone (joyful, peaceful, energetic, inspiring)
- style: Visual style (modern, rustic, professional, natural)
- activity: Actions depicted (planting, watering, harvesting, relaxing)
- setting: Location context (outdoor garden, greenhouse, nursery, patio)

Return ONLY a JSON object with this exact structure:
{
  "tags": [
    {"name": "roses", "category": "subject", "confidence": 0.95},
    {"name": "vibrant", "category": "color", "confidence": 0.88}
  ]
}

Each tag must have:
- name: lowercase, descriptive, 1-3 words max
- category: one of the exact categories listed above
- confidence: 0.60 to 1.00 (your confidence this tag applies)

Focus on tags that would help find similar images in future searches.`
          },
          {
            role: 'user',
            content: `Generate tags for an AI-generated image with this context:

Title: "${contentTitle}"
Content: "${contentContext}"
Channel: ${channel}

Provide 10-15 tags that capture the visual elements this image would contain.`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsedResponse = JSON.parse(content);

    // Validate and normalize tags
    const tags: GeneratedTag[] = (parsedResponse.tags || [])
      .filter((tag: any) => 
        tag.name && 
        tag.category && 
        tag.confidence >= 0.6 && 
        tag.confidence <= 1.0
      )
      .map((tag: any) => ({
        name: tag.name.toLowerCase().trim(),
        category: tag.category,
        confidence: parseFloat(tag.confidence.toFixed(2))
      }));

    console.log(`✅ Generated ${tags.length} tags`);

    return new Response(
      JSON.stringify({ tags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Tag generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message, tags: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
