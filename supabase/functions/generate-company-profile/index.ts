
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { aboutBusiness, toneSamples, annualEvents } = await req.json();

    const prompt = `Based on the following onboarding information, generate a comprehensive company profile for a garden center. Respond with a JSON object containing the following fields:

Onboarding Data:
- About Business: ${aboutBusiness}
- Tone Samples: ${toneSamples}
- Annual Events: ${annualEvents}

Generate a JSON response with these exact fields:
- company_name: Extract or suggest a company name
- company_overview: A comprehensive overview (2-3 sentences)
- brand_voice: Describe the brand voice based on tone samples (1-2 sentences)
- tone_of_writing: Specific tone characteristics (1-2 sentences)
- target_audience: Who are their main customers (1-2 sentences)
- ideal_customer: Detailed customer profile (2-3 sentences)
- unique_selling_points: What sets them apart (2-3 key points)
- company_values: Core values based on the information (2-3 values)
- seasonal_focus: Key seasonal activities and promotions based on annual events
- specializations: Areas of expertise mentioned or inferred
- location_info: Location and community context if mentioned

Return only valid JSON, no additional text.`;

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
            content: 'You are an expert marketing consultant specializing in garden centers. Generate detailed, professional company profiles based on onboarding information. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    // Parse the JSON response
    let profileData;
    try {
      profileData = JSON.parse(generatedContent);
    } catch (error) {
      console.error('Failed to parse JSON response:', generatedContent);
      throw new Error('Invalid JSON response from AI');
    }

    return new Response(JSON.stringify({ profileData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-company-profile function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
