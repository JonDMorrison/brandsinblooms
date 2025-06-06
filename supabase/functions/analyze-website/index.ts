
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
    console.log('Starting website analysis function');
    
    const { websiteUrl } = await req.json();
    console.log('Received request for URL:', websiteUrl);

    if (!websiteUrl) {
      console.error('No website URL provided');
      throw new Error('Website URL is required');
    }

    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    console.log('Analyzing website:', websiteUrl);

    // Fetch website content
    let websiteContent = '';
    try {
      const normalizedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
      console.log('Fetching content from:', normalizedUrl);
      
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      console.log('Fetch response status:', response.status);
      console.log('Fetch response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error(`Failed to fetch website: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }

      websiteContent = await response.text();
      console.log('Website content fetched, length:', websiteContent.length);
      
      if (websiteContent.length === 0) {
        console.error('Website returned empty content');
        throw new Error('Website returned empty content');
      }
      
      // Clean up HTML content - remove scripts, styles, and extract meaningful text
      const cleanContent = websiteContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
      
      console.log('Cleaned content length:', cleanContent.length);
      
      // Take first 12000 characters for analysis
      const contentForAnalysis = cleanContent.slice(0, 12000);
      
      if (contentForAnalysis.length < 100) {
        console.error('Website content is too short after cleaning:', contentForAnalysis.length);
        throw new Error('Website content is too short or could not be properly extracted');
      }

      console.log('Content ready for analysis, length:', contentForAnalysis.length);

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

      console.log('Sending request to OpenAI');

      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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

      console.log('OpenAI response status:', openAIResponse.status);

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('OpenAI API error:', openAIResponse.status, errorText);
        throw new Error(`OpenAI API error: ${openAIResponse.status} - ${errorText}`);
      }

      const data = await openAIResponse.json();
      console.log('OpenAI response received successfully');

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
          console.error('No JSON found in OpenAI response');
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('Raw AI response:', data.choices[0].message.content);
        throw new Error('Failed to parse extracted data from AI response');
      }

      console.log('Final extracted data:', extractedData);

      return new Response(JSON.stringify({ extractedData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (fetchError) {
      console.error('Error fetching website:', fetchError);
      console.error('Fetch error details:', {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack
      });
      
      // Return a more specific error message based on the error type
      let errorMessage = 'Could not access the website. ';
      if (fetchError.name === 'TimeoutError') {
        errorMessage += 'The website took too long to respond.';
      } else if (fetchError.message.includes('ENOTFOUND') || fetchError.message.includes('ECONNREFUSED')) {
        errorMessage += 'The website could not be found or is not accessible.';
      } else if (fetchError.message.includes('SSL') || fetchError.message.includes('certificate')) {
        errorMessage += 'There was an SSL/security issue with the website.';
      } else {
        errorMessage += 'Please check the URL and try again.';
      }
      
      throw new Error(errorMessage);
    }

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze website',
      details: 'Please check the website URL and try again, or use manual entry instead.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
