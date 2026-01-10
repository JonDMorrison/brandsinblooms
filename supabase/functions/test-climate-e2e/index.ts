import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildClimateConstraints, buildImageClimateConstraints, extractClimateProfile } from '../_shared/climateConstraints.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Mock profiles for testing
const TEST_PROFILES = {
  phoenix: {
    postal_code: '85001',
    city: 'Phoenix',
    state_province: 'AZ',
    country: 'US',
    location_info: 'Phoenix, AZ',
    latitude: 33.448376,
    longitude: -112.074036,
    climate_archetype: 'hot_dry',
    climate_label: 'Hot & Dry Desert Climate',
    climate_confidence: 'high',
    climate_source: 'state_mapping',
    climate_last_updated_at: new Date().toISOString(),
    usda_zone: null,
    first_frost_date: null,
    last_frost_date: null,
    company_name: 'Desert Bloom Garden Center',
    specializations: 'Xeriscaping, succulents, desert natives',
  },
  minneapolis: {
    postal_code: '55401',
    city: 'Minneapolis',
    state_province: 'MN',
    country: 'US',
    location_info: 'Minneapolis, MN',
    latitude: 44.977753,
    longitude: -93.265011,
    climate_archetype: 'cold',
    climate_label: 'Cold Continental Climate',
    climate_confidence: 'high',
    climate_source: 'state_mapping',
    climate_last_updated_at: new Date().toISOString(),
    usda_zone: null,
    first_frost_date: null,
    last_frost_date: null,
    company_name: 'Northern Roots Nursery',
    specializations: 'Cold-hardy perennials, native plants, season extension',
  }
};

async function generateContent(profile: any, postType: string, campaignTitle: string): Promise<{ prompt: string; output: string }> {
  const climateProfile = extractClimateProfile(profile);
  const climateConstraints = buildClimateConstraints(climateProfile);
  
  const prompt = `You are a garden center marketing expert creating ${postType} content.

# BUSINESS CONTEXT
Company: ${profile.company_name}
Location: ${profile.city}, ${profile.state_province}
Specializations: ${profile.specializations}

# CAMPAIGN
Topic: ${campaignTitle}

${climateConstraints}

# REQUIREMENTS
- 60-100 words
- Include specific plant recommendations appropriate for the climate
- Reference seasonal timing appropriate for the location
- NO emojis, NO hashtags
- Professional, helpful tone

Generate the ${postType} content now:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  const output = data.choices?.[0]?.message?.content || 'ERROR: No content generated';

  return { prompt, output };
}

async function generateImagePrompt(profile: any, campaignTitle: string): Promise<{ constraints: string; prompt: string }> {
  const climateProfile = extractClimateProfile(profile);
  const imageConstraints = buildImageClimateConstraints(climateProfile, 'spring');
  
  const prompt = `Generate an image prompt for a garden center social media post about "${campaignTitle}" for ${profile.company_name} in ${profile.city}, ${profile.state_province}.

${imageConstraints}

Create a detailed image generation prompt (50-80 words) that:
1. Shows a garden center retail environment
2. Features plants appropriate for the climate archetype
3. Matches the seasonal and regional context
4. Includes specific plant varieties mentioned in the constraints`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  const data = await response.json();
  const output = data.choices?.[0]?.message?.content || 'ERROR: No prompt generated';

  return { constraints: imageConstraints, prompt: output };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const campaignTitle = 'Spring Planting Tips';
    
    console.log('🧪 E2E Climate Constraints Verification Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const results: any = {
      step1_stored_profiles: {},
      step2_prompt_injection: {},
      step3_outputs: {},
      step4_assertions: {},
    };

    // ========== STEP 1: Verify Stored Climate Profiles ==========
    console.log('\n📋 STEP 1: Stored Climate Profiles');
    
    for (const [location, profile] of Object.entries(TEST_PROFILES)) {
      results.step1_stored_profiles[location] = {
        postal_code: profile.postal_code,
        latitude: profile.latitude,
        longitude: profile.longitude,
        climate_archetype: profile.climate_archetype,
        climate_label: profile.climate_label,
        climate_confidence: profile.climate_confidence,
        climate_source: profile.climate_source,
        climate_last_updated_at: profile.climate_last_updated_at,
      };
    }

    // ========== STEP 2: Verify Prompt Injection ==========
    console.log('\n📋 STEP 2: Climate Constraints Blocks');
    
    for (const [location, profile] of Object.entries(TEST_PROFILES)) {
      const climateProfile = extractClimateProfile(profile);
      const textConstraints = buildClimateConstraints(climateProfile);
      const imageConstraints = buildImageClimateConstraints(climateProfile, 'spring');
      
      results.step2_prompt_injection[location] = {
        text_content_constraints: textConstraints,
        image_constraints: imageConstraints,
      };
    }

    // ========== STEP 3: Generate Content for Comparison ==========
    console.log('\n📋 STEP 3: Generating Content Outputs');
    
    // Instagram posts
    console.log('  → Generating Instagram posts...');
    const phoenixInstagram = await generateContent(TEST_PROFILES.phoenix, 'instagram', campaignTitle);
    const minneapolisInstagram = await generateContent(TEST_PROFILES.minneapolis, 'instagram', campaignTitle);

    // Newsletter sections
    console.log('  → Generating newsletter sections...');
    const phoenixNewsletter = await generateContent(TEST_PROFILES.phoenix, 'newsletter', campaignTitle);
    const minneapolisNewsletter = await generateContent(TEST_PROFILES.minneapolis, 'newsletter', campaignTitle);

    // Image prompts
    console.log('  → Generating image prompts...');
    const phoenixImage = await generateImagePrompt(TEST_PROFILES.phoenix, campaignTitle);
    const minneapolisImage = await generateImagePrompt(TEST_PROFILES.minneapolis, campaignTitle);

    results.step3_outputs = {
      instagram: {
        phoenix: phoenixInstagram.output,
        minneapolis: minneapolisInstagram.output,
      },
      newsletter: {
        phoenix: phoenixNewsletter.output,
        minneapolis: minneapolisNewsletter.output,
      },
      image_prompts: {
        phoenix: phoenixImage.prompt,
        minneapolis: minneapolisImage.prompt,
      },
    };

    // ========== STEP 4: Sanity Assertions ==========
    console.log('\n📋 STEP 4: Running Assertions');
    
    const phoenixImageLower = phoenixImage.prompt.toLowerCase();
    const minneapolisImageLower = minneapolisImage.prompt.toLowerCase();
    const phoenixContentLower = (phoenixInstagram.output + phoenixNewsletter.output).toLowerCase();
    const minneapolisContentLower = (minneapolisInstagram.output + minneapolisNewsletter.output).toLowerCase();
    
    // Image assertions
    const imageHasArchetype = phoenixImage.constraints.includes('hot_dry') && minneapolisImage.constraints.includes('cold');
    const imageHasMustAvoid = phoenixImage.constraints.includes('MUST EXCLUDE') && minneapolisImage.constraints.includes('MUST EXCLUDE');
    
    // Phoenix content assertions
    const phoenixMentionsHeat = phoenixContentLower.includes('heat') || 
                                phoenixContentLower.includes('drought') || 
                                phoenixContentLower.includes('desert') ||
                                phoenixContentLower.includes('water') ||
                                phoenixContentLower.includes('succulent') ||
                                phoenixContentLower.includes('xeriscape');
    
    // Minneapolis content assertions
    const minneapolisMentionsFrost = minneapolisContentLower.includes('frost') || 
                                     minneapolisContentLower.includes('cold') || 
                                     minneapolisContentLower.includes('hardy') ||
                                     minneapolisContentLower.includes('short season') ||
                                     minneapolisContentLower.includes('zone');
    
    // Negative assertions
    const noCactusMinneapolis = !minneapolisContentLower.includes('cactus') && 
                                !minneapolisContentLower.includes('cacti') &&
                                !minneapolisImageLower.includes('cactus');
    
    const noFrostFramingPhoenix = !phoenixContentLower.includes('before frost') &&
                                  !phoenixContentLower.includes('frost date') &&
                                  !phoenixContentLower.includes('bring indoors before');

    results.step4_assertions = {
      'Image prompt includes climate_archetype and MUST AVOID list': {
        pass: imageHasArchetype && imageHasMustAvoid,
        evidence: {
          phoenix_archetype_in_constraints: phoenixImage.constraints.includes('hot_dry'),
          minneapolis_archetype_in_constraints: minneapolisImage.constraints.includes('cold'),
          must_avoid_present: imageHasMustAvoid,
        }
      },
      'Phoenix output mentions heat/drought considerations': {
        pass: phoenixMentionsHeat,
        evidence: {
          content_snippet: phoenixContentLower.substring(0, 200),
          found_keywords: [
            phoenixContentLower.includes('heat') ? 'heat' : null,
            phoenixContentLower.includes('drought') ? 'drought' : null,
            phoenixContentLower.includes('desert') ? 'desert' : null,
            phoenixContentLower.includes('water') ? 'water' : null,
            phoenixContentLower.includes('succulent') ? 'succulent' : null,
          ].filter(Boolean),
        }
      },
      'Minneapolis output mentions frost/short season considerations': {
        pass: minneapolisMentionsFrost,
        evidence: {
          content_snippet: minneapolisContentLower.substring(0, 200),
          found_keywords: [
            minneapolisContentLower.includes('frost') ? 'frost' : null,
            minneapolisContentLower.includes('cold') ? 'cold' : null,
            minneapolisContentLower.includes('hardy') ? 'hardy' : null,
            minneapolisContentLower.includes('short season') ? 'short season' : null,
          ].filter(Boolean),
        }
      },
      'No cactus outdoor recommendations for Minneapolis': {
        pass: noCactusMinneapolis,
        evidence: {
          cactus_in_content: minneapolisContentLower.includes('cactus'),
          cactus_in_image: minneapolisImageLower.includes('cactus'),
        }
      },
      'No "bring indoors before frost" as primary framing for Phoenix': {
        pass: noFrostFramingPhoenix,
        evidence: {
          frost_framing_found: !noFrostFramingPhoenix,
          content_check: phoenixContentLower.includes('before frost') || phoenixContentLower.includes('bring indoors'),
        }
      },
    };

    // Summary
    const allPassed = Object.values(results.step4_assertions).every((a: any) => a.pass);
    
    results.summary = {
      all_tests_passed: allPassed,
      pass_count: Object.values(results.step4_assertions).filter((a: any) => a.pass).length,
      total_tests: Object.keys(results.step4_assertions).length,
    };

    console.log(`\n✅ Test Complete: ${results.summary.pass_count}/${results.summary.total_tests} passed`);

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ E2E Test Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
