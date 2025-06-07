
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    let websiteContent = '';
    let extractionMethod = '';

    // Normalize URL
    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // First, try the direct fetch method with better error handling
    try {
      console.log('Attempting direct fetch from:', normalizedUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('Direct fetch response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.log('Direct fetch failed with status:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        console.log('Response is not HTML, content-type:', contentType);
        throw new Error('Website did not return HTML content');
      }

      websiteContent = await response.text();
      extractionMethod = 'direct';
      console.log('Direct fetch successful, content length:', websiteContent.length);
      
    } catch (directFetchError) {
      console.log('Direct fetch failed:', directFetchError.message);
      
      // Fallback to Firecrawl if available
      if (firecrawlApiKey) {
        try {
          console.log('Using Firecrawl API as fallback');
          
          const firecrawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: normalizedUrl,
              formats: ['markdown'],
              onlyMainContent: true,
              waitFor: 3000,
              timeout: 15000,
            }),
          });

          console.log('Firecrawl response status:', firecrawlResponse.status);

          if (!firecrawlResponse.ok) {
            const errorText = await firecrawlResponse.text();
            console.error('Firecrawl API error:', firecrawlResponse.status, errorText);
            throw new Error(`Firecrawl API error: ${firecrawlResponse.status}`);
          }

          const firecrawlData = await firecrawlResponse.json();
          console.log('Firecrawl response received');

          if (firecrawlData.success && firecrawlData.data && firecrawlData.data.markdown) {
            websiteContent = firecrawlData.data.markdown;
            extractionMethod = 'firecrawl';
            console.log('Firecrawl extraction successful, content length:', websiteContent.length);
          } else {
            console.error('Firecrawl did not return valid data:', firecrawlData);
            throw new Error('Firecrawl extraction failed - no valid content returned');
          }
          
        } catch (firecrawlError) {
          console.error('Firecrawl extraction failed:', firecrawlError.message);
          throw new Error(`Website analysis failed. Direct fetch error: ${directFetchError.message}. Firecrawl error: ${firecrawlError.message}`);
        }
      } else {
        console.error('No Firecrawl API key available for fallback');
        throw new Error(`Website analysis failed: ${directFetchError.message}. Please check the URL and try again.`);
      }
    }

    if (!websiteContent || websiteContent.length < 100) {
      console.error('Website content is too short:', websiteContent.length);
      throw new Error('Website content is too short or empty. Please check the URL.');
    }
    
    // Clean up content for analysis
    let cleanContent = websiteContent;
    if (extractionMethod === 'direct') {
      // Clean HTML content
      cleanContent = websiteContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
    }
    // Firecrawl already returns clean markdown content
    
    console.log('Cleaned content length:', cleanContent.length);
    
    // Take first 8000 characters for analysis to stay within token limits
    const contentForAnalysis = cleanContent.slice(0, 8000);
    
    if (contentForAnalysis.length < 50) {
      console.error('Content too short after cleaning:', contentForAnalysis.length);
      throw new Error('Website content is too short after processing');
    }

    console.log('Content ready for OpenAI analysis, length:', contentForAnalysis.length);

    // Use OpenAI to analyze the website content
    const prompt = `Analyze this website content and extract business information. Return ONLY valid JSON:

${contentForAnalysis}

Extract and return JSON in this exact format:
{
  "businessName": "exact business name found",
  "aboutBusiness": "detailed description of what they do",
  "location": "city, state, or address if found",
  "services": "products, services, specializations they offer",
  "brandVoice": "actual sentences showing their writing style",
  "annualEvents": "seasonal events, sales, workshops mentioned"
}

CRITICAL: 
- Return ONLY the JSON object, no other text
- Use empty strings "" if information is not found
- Extract any garden center, nursery, landscaping, or plant-related information
- Focus on finding their business name, location, and what they sell`;

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
            content: 'You are an expert at analyzing websites to extract business information. Always respond with valid JSON only. Be thorough but concise.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    console.log('OpenAI response status:', openAIResponse.status);

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const data = await openAIResponse.json();
    console.log('OpenAI response received');

    let extractedData;
    try {
      const content = data.choices[0].message.content.trim();
      console.log('AI response content:', content);
      
      // Clean up the response to ensure it's valid JSON
      let jsonString = content;
      
      // Remove any markdown formatting
      jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find JSON object in the response
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      extractedData = JSON.parse(jsonString);
      
      // Validate structure
      const requiredFields = ['businessName', 'aboutBusiness', 'location', 'services', 'brandVoice', 'annualEvents'];
      for (const field of requiredFields) {
        if (!(field in extractedData)) {
          extractedData[field] = "";
        }
      }
      
      console.log('Successfully parsed extracted data');
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw AI response:', data.choices[0].message.content);
      
      // Fallback: create a basic structure
      extractedData = {
        businessName: "",
        aboutBusiness: "Business information extracted from website",
        location: "",
        services: "",
        brandVoice: "",
        annualEvents: ""
      };
    }

    console.log('Final extracted data:', extractedData);
    console.log('Analysis completed using:', extractionMethod);

    return new Response(JSON.stringify({ 
      extractedData,
      extractionMethod 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze website',
      details: 'Please check the website URL is correct and accessible, then try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
