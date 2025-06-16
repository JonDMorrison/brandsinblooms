
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

import { corsHeaders } from './constants.ts';
import { buildContentPrompt } from './prompt-builder.ts';
import { generateContentWithValidation } from './openai-client.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postType, campaignTitle, userId, weekDescription, enforceCompanyName } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch company profile for personalization with enhanced business name handling
    let companyProfile = null;
    if (userId) {
      const { data: profileData, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profileData) {
        companyProfile = profileData;
        
        // Ensure company_name is prioritized and consistent
        if (!companyProfile.company_name && companyProfile.company_overview) {
          // Try to extract business name from company overview if not explicitly set
          const overviewText = companyProfile.company_overview;
          const nameMatch = overviewText.match(/^([^,\.!?]+?)(?:\s+(?:has been|is|provides|offers|specializes|located))/i);
          if (nameMatch) {
            companyProfile.company_name = nameMatch[1].trim();
            
            // Update the database with extracted name for future consistency
            await supabase
              .from('company_profiles')
              .update({ company_name: companyProfile.company_name })
              .eq('user_id', userId);
          }
        }
        
        console.log(`Content generation for: ${companyProfile.company_name || 'Unknown Business'} (User: ${userId})`);
      } else {
        console.warn(`No company profile found for user: ${userId}`);
      }
    }

    // Build content-type specific prompt with company name enforcement
    const prompt = buildContentPrompt(postType, campaignTitle, companyProfile, weekDescription, enforceCompanyName);
    
    console.log(`Generating validated ${postType} content for: ${campaignTitle}${companyProfile?.company_name ? ` (${companyProfile.company_name})` : ''}`);

    // Generate content with validation - use fewer attempts for faster generation
    const maxAttempts = postType === 'instagram' ? 2 : 3; // Instagram gets relaxed validation
    const result = await generateContentWithValidation(prompt, openAIApiKey, postType, maxAttempts);

    console.log(`Generated content successfully after ${result.attempts} attempts`);

    return new Response(JSON.stringify({ 
      content: result.content,
      generationAttempts: result.attempts,
      validationPassed: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
