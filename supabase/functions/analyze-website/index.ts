
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status}`);
      }

      websiteContent = await response.text();
      console.log('Website content fetched, length:', websiteContent.length);
      
      // Clean up HTML content - remove scripts, styles, and extract text
      const cleanContent = websiteContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('Cleaned content length:', cleanContent.length);
      
    } catch (error) {
      console.error('Error fetching website:', error);
      throw new Error('Could not access the website. Please check the URL and try again.');
    }

    // Use OpenAI to analyze the website content
    const prompt = `
You are an expert at analyzing garden center and nursery websites. Please analyze the following website content and extract key business information.

Website Content:
${websiteContent.slice(0, 15000)}

Please extract and provide the following information in JSON format. Be thorough and look for any relevant information, even if it's not perfectly structured. If you find partial information, include it rather than saying "Not specified":

{
  "businessName": "Extract the business/company name - look in headers, titles, about sections",
  "aboutBusiness": "Extract a comprehensive description of what the business does, their story, mission, services offered (look in about us, home page descriptions, service sections)",
  "location": "Extract location information - city, state, address information",
  "services": "Extract main services, products, specializations, what they sell (plants, garden supplies, landscaping, etc.)",
  "brandVoice": "Extract 1-2 actual sentences from the website that show their writing style and tone",
  "annualEvents": "Extract any seasonal events, sales, workshops, classes, or recurring promotions mentioned"
}

Instructions:
- Look carefully through ALL the content for any business information
- For businessName: check page titles, headers, footers, contact sections
- For aboutBusiness: look for "about us", company descriptions, mission statements, what they do
- For location: check contact info, addresses, "visit us", footer information
- For services: look for product listings, service descriptions, what they offer
- For brandVoice: find actual text that shows personality - avoid generic descriptions
- For annualEvents: look for events calendar, seasonal promotions, workshop schedules
- If you find ANY relevant information, include it even if incomplete
- Only use "Not specified" if absolutely no relevant information exists for that field
- Focus on garden center, nursery, and plant-related content specifically
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
          { role: 'system', content: 'You are an expert at analyzing garden center websites and extracting business information. Always respond with valid JSON. Be thorough and extract any relevant information you can find.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    let extractedData;
    try {
      const content = data.choices[0].message.content;
      console.log('AI response content:', content);
      
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
