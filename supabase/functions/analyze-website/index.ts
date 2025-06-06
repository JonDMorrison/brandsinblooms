
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
      
      // Clean up HTML content - remove scripts, styles, and extract meaningful text
      const cleanContent = websiteContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
      
      console.log('Cleaned content length:', cleanContent.length);
      console.log('First 500 chars of cleaned content:', cleanContent.slice(0, 500));
      
      // Take first 12000 characters for analysis
      const contentForAnalysis = cleanContent.slice(0, 12000);
      
      if (contentForAnalysis.length < 100) {
        throw new Error('Website content is too short or could not be properly extracted');
      }

      // Use OpenAI to analyze the website content
      const prompt = `You are an expert at analyzing garden center and nursery websites to extract business information. 

Analyze this website content and extract key business details:

${contentForAnalysis}

Extract the following information and respond in valid JSON format:

{
  "businessName": "exact business name found",
  "aboutBusiness": "detailed description of what they do, their story, mission",
  "location": "city, state, or address if found",
  "services": "products, services, specializations they offer",
  "brandVoice": "actual sentences from their website showing their writing style",
  "annualEvents": "seasonal events, sales, workshops, classes mentioned"
}

CRITICAL INSTRUCTIONS:
1. Look carefully for the business name in headers, titles, navigation, contact sections
2. Find their "About Us" section, company description, or mission statement
3. Look for location in contact info, footer, or "Visit Us" sections
4. Identify what products/services they sell (plants, landscaping, supplies, etc.)
5. Find actual text that shows their personality and tone of voice
6. Look for seasonal events, workshops, sales, or recurring activities
7. If you cannot find specific information, put an empty string ""
8. Focus specifically on garden centers, nurseries, and plant-related businesses
9. Extract ANY relevant information you can find, even if partial

Respond ONLY with valid JSON, no additional text.`;

      console.log('Sending request to OpenAI with prompt length:', prompt.length);

      const response2 = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are an expert at analyzing garden center and nursery websites. Always respond with valid JSON containing the requested business information. Be thorough in your analysis and extract any relevant information you can find.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response2.ok) {
        const errorText = await response2.text();
        console.error('OpenAI API error:', response2.status, errorText);
        throw new Error(`OpenAI API error: ${response2.status}`);
      }

      const data = await response2.json();
      console.log('OpenAI response received');

      let extractedData;
      try {
        const content = data.choices[0].message.content;
        console.log('AI response content:', content);
        
        // Clean up the response to ensure it's valid JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
          
          // Ensure we have the expected structure
          extractedData = {
            businessName: extractedData.businessName || "",
            aboutBusiness: extractedData.aboutBusiness || "",
            location: extractedData.location || "",
            services: extractedData.services || "",
            brandVoice: extractedData.brandVoice || "",
            annualEvents: extractedData.annualEvents || ""
          };
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse extracted data from AI response');
      }

      console.log('Final extracted data:', extractedData);

      return new Response(JSON.stringify({ extractedData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (fetchError) {
      console.error('Error fetching website:', fetchError);
      throw new Error('Could not access the website. Please check the URL and try again.');
    }

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
