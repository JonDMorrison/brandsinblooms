
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from './constants.ts';
import { buildContentPrompt } from './prompt-builder.ts';
import { generateContentWithValidation } from './openai-client.ts';
import { sanitizeWeekNumbers, logWeekNumberViolation } from './week-sanitizer.ts';
import { validateLocationForGeneration, locationBlockedResponse } from '../_shared/locationGuard.ts';
import { resolveBusinessProfileUserId } from '../_shared/businessProfileUserId.ts';
import {
  authorizeGeneratorRequest,
  readJsonBody,
  type GeneratorAuthDeps,
  type GeneratorProfileClient,
} from '../_shared/generatorAuth.ts';

interface GenerateContentRequest {
  postType: string;
  campaignTitle: string;
  weekDescription?: string;
  enforceCompanyName?: boolean;
  customPrompt?: string;
}

interface ProfileUpdateClient {
  from(table: 'company_profiles'): {
    update(values: { company_name: string }): {
      eq(column: string, value: string): PromiseLike<unknown>;
    };
  };
}

export interface GenerateContentDeps extends GeneratorAuthDeps {
  validateLocation: typeof validateLocationForGeneration;
}

const defaultDeps: GenerateContentDeps = {
  createClient: createClient as GeneratorAuthDeps['createClient'],
  envGet: (key) => Deno.env.get(key),
  validateLocation: validateLocationForGeneration,
};

export async function handleGenerateContent(
  req: Request,
  deps: GenerateContentDeps = defaultDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await readJsonBody<GenerateContentRequest>(req);
    // The caller's JWT and tenant membership are verified before any query.
    // The user is the token's user; a userId in the body is ignored.
    const auth = await authorizeGeneratorRequest(req, body, deps, corsHeaders);
    if (!auth.ok) return auth.response;

    const { postType, campaignTitle, weekDescription, enforceCompanyName, customPrompt } = body;
    const userId = auth.userId;

    const openAIApiKey = deps.envGet('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Location validation guard - block legacy profiles without confirmed location
    const locationResult = await deps.validateLocation(userId);
    if (!locationResult.isValid) {
      console.warn(`🚫 Content generation blocked for user ${userId}: ${locationResult.error}`);
      return locationBlockedResponse();
    }

    // profile_user_id_for is executable by service_role only, and the
    // company-name write-back below updates the business profile row, so the
    // service key is kept for those two calls, after the checks above. The
    // profile itself is read with the caller's JWT (RLS: own or business).
    const serviceClient = deps.createClient(
      deps.envGet('SUPABASE_URL')!,
      deps.envGet('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const userClient = auth.userClient as GeneratorProfileClient;

    let prompt = '';

    // Use custom prompt if provided (for holiday content), otherwise build standard prompt
    if (customPrompt) {
      console.log(`Using custom holiday prompt for ${postType} content`);
      prompt = customPrompt;
    } else {
      // Fetch company profile for personalization with enhanced business name handling
      let companyProfile = null;
      if (userId) {
        const profileUserId = await resolveBusinessProfileUserId(
          serviceClient as Parameters<typeof resolveBusinessProfileUserId>[0],
          userId,
        );
        const { data: profileData, error: profileError } = await userClient
          .from('company_profiles')
          .select('*')
          .eq('user_id', profileUserId)
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
              await (serviceClient as ProfileUpdateClient)
                .from('company_profiles')
                .update({ company_name: companyProfile.company_name })
                .eq('user_id', profileUserId);
            }
          }
          
          console.log(`Content generation for: ${companyProfile.company_name || 'Unknown Business'} (User: ${userId})`);
        } else {
          console.warn(`No company profile found for user: ${userId}`);
        }
      }

      // Build content-type specific prompt with company name enforcement
      prompt = buildContentPrompt(postType, campaignTitle, companyProfile, weekDescription, enforceCompanyName);
      
      // Log the prompt being sent for blog content to verify HTML instructions
      if (postType === 'blog') {
        console.log(`🔍 BLOG PROMPT INCLUDES HTML INSTRUCTIONS: ${prompt.includes('HTML')} | ${prompt.includes('<h2>')}`);
      }
    }
    
    console.log(`Generating high-quality ${postType} content for: ${campaignTitle}${customPrompt ? ' (holiday-specific)' : ''}`);

    // Generate content with validation - use more attempts for higher quality
    const maxAttempts = postType === 'instagram' || postType === 'facebook' ? 5 : 4; // More attempts for social media
    const result = await generateContentWithValidation(prompt, openAIApiKey, postType, maxAttempts);

    console.log(`Generated high-quality content successfully after ${result.attempts} attempts`);

    // Sanitize the final content to ensure no week numbers
    const sanitizedContent = sanitizeWeekNumbers(result.content);
    
    // Log any week number violations that were found and removed
    if (sanitizedContent !== result.content) {
      logWeekNumberViolation(result.content, `${postType} generation for ${campaignTitle}`);
    }

    return new Response(JSON.stringify({ 
      content: sanitizedContent,
      imageQuery: result.imageQuery || '',
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
}

if (import.meta.main) {
  serve((req) => handleGenerateContent(req));
}
