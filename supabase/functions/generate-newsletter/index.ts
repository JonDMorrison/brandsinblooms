
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

import { buildCompanyContext, buildNewsletterPrompt } from './prompt-builder.ts';
import { fetchCompanyProfile } from './company-profile-handler.ts';
import { fetchCampaignContent, processAIResponse } from './content-processor.ts';
import { generateNewsletterWithOpenAI } from './openai-client.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, campaignTitle, weekNumber, userId } = await req.json();

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch company profile for personalization
    const companyProfile = await fetchCompanyProfile(supabase, userId);

    // Fetch all content tasks for this campaign (excluding newsletter)
    const contentSummary = await fetchCampaignContent(supabase, campaignId);

    // Build company context for AI with enhanced regional focus
    const companyContext = buildCompanyContext(companyProfile);

    // Build the complete prompt
    const prompt = buildNewsletterPrompt(companyContext, campaignTitle, contentSummary);

    // Generate newsletter with OpenAI
    const aiResponse = await generateNewsletterWithOpenAI(openAIApiKey!, prompt);

    // Process AI response
    const newsletterData = processAIResponse(aiResponse, companyProfile, campaignTitle);

    console.log('Generated enhanced newsletter with improved writing style and NO week number references:', newsletterData);

    return new Response(JSON.stringify(newsletterData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-newsletter function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
