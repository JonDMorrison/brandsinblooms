
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { websiteUrl } = await req.json();

    if (!websiteUrl) {
      throw new Error('Website URL is required');
    }

    console.log('Analyzing website:', websiteUrl);

    // Fetch website content
    let websiteContent = '';
    try {
      const normalizedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GardenCenterBot/1.0)',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status}`);
      }

      websiteContent = await response.text();
      console.log('Website content fetched, length:', websiteContent.length);
    } catch (error) {
      console.error('Error fetching website:', error);
      throw new Error('Could not access the website. Please check the URL and try again.');
    }

    // Use OpenAI to analyze the website content
    const prompt = `
You are an expert at analyzing garden center and nursery websites. Please analyze the following website content and extract key business information.

Website Content:
${websiteContent.slice(0, 10000)} // Limit content to avoid token limits

Please extract and provide the following information in JSON format:
{
  "businessName": "Extract the business/company name",
  "aboutBusiness": "Extract a comprehensive description of the business, what they do, their history, mission, etc. (2-3 sentences)",
  "location": "Extract location information (city, state/region)",
  "services": "Extract main services, products, or specializations they offer",
  "brandVoice": "Analyze the tone and writing style used on the website. Extract 2-3 example sentences that best represent their brand voice",
  "annualEvents": "Extract any recurring events, sales, workshops, or seasonal promotions mentioned"
}

Important guidelines:
- If information is not clearly available, use "Not specified" rather than making assumptions
- For brandVoice, quote actual text from the website that shows their tone
- For annualEvents, look for seasonal sales, workshops, classes, festivals, etc.
- Keep descriptions concise but informative
- Focus on garden center, nursery, and plant-related content
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing garden center websites and extracting business information. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    let extractedData;
    try {
      const content = data.choices[0].message.content;
      // Clean up the response to ensure it's valid JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse extracted data from AI response');
    }

    console.log('Extracted data:', extractedData);

    return new Response(JSON.stringify({ extractedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze website',
      details: 'Please check the website URL and try again, or use manual entry instead.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
