import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyTheme {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  start_date: string;
  user_id: string;
  tenant_id: string;
}

interface TenantSettings {
  tenant_id: string;
  user_id: string;
  auto_create_weekly_campaigns: boolean;
  crm_enabled: boolean;
  personas: any[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting weekly campaign auto-generation...');

    // Get current week information
    const currentDate = new Date();
    const currentWeek = getWeekNumber(currentDate);
    const startOfWeek = getStartOfWeek(currentDate);

    console.log(`📅 Processing week ${currentWeek}, starting ${startOfWeek.toISOString()}`);

    // Get all tenants with auto-generation enabled and CRM enabled
    const { data: tenantSettings, error: tenantsError } = await supabase
      .from('users')
      .select(`
        id,
        tenant_id,
        company_profiles!inner(
          id,
          feature_flags
        ),
        subscriptions!inner(
          crm_enabled
        )
      `)
      .eq('subscriptions.crm_enabled', true);

    if (tenantsError) {
      throw new Error(`Failed to fetch tenant settings: ${tenantsError.message}`);
    }

    console.log(`🏢 Found ${tenantSettings?.length || 0} tenants with CRM enabled`);

    if (!tenantSettings || tenantSettings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No tenants with CRM enabled found',
        campaignsCreated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let campaignsCreated = 0;
    const errors: string[] = [];

    // Process each tenant
    for (const tenant of tenantSettings) {
      try {
        // Check if auto-generation is enabled for this tenant (default to true if not set)
        const autoGenEnabled = tenant.company_profiles?.feature_flags?.auto_create_weekly_campaigns !== false;
        
        if (!autoGenEnabled) {
          console.log(`⏭️ Skipping tenant ${tenant.tenant_id} - auto-generation disabled`);
          continue;
        }

        // Find current week's theme for this tenant
        const { data: weeklyThemes, error: themesError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('tenant_id', tenant.tenant_id)
          .eq('week_number', currentWeek)
          .gte('start_date', startOfWeek.toISOString().split('T')[0])
          .limit(1);

        if (themesError) {
          console.error(`❌ Error fetching themes for tenant ${tenant.tenant_id}:`, themesError);
          errors.push(`Tenant ${tenant.tenant_id}: ${themesError.message}`);
          continue;
        }

        if (!weeklyThemes || weeklyThemes.length === 0) {
          console.log(`⏭️ No theme found for tenant ${tenant.tenant_id}, week ${currentWeek}`);
          continue;
        }

        const theme = weeklyThemes[0] as WeeklyTheme;

        // Check if auto-draft already exists for this theme
        const { data: existingCampaigns, error: existingError } = await supabase
          .from('crm_campaigns')
          .select('id')
          .eq('tenant_id', tenant.tenant_id)
          .eq('synced_from', theme.id)
          .eq('status', 'draft');

        if (existingError) {
          console.error(`❌ Error checking existing campaigns for tenant ${tenant.tenant_id}:`, existingError);
          continue;
        }

        if (existingCampaigns && existingCampaigns.length > 0) {
          console.log(`⏭️ Auto-draft already exists for tenant ${tenant.tenant_id}, theme ${theme.id}`);
          continue;
        }

        // Get theme content for AI generation
        const { data: contentTasks, error: contentError } = await supabase
          .from('content_tasks')
          .select('ai_output, notes')
          .eq('campaign_id', theme.id)
          .limit(5);

        let themeContent = theme.theme || '';
        if (contentTasks && contentTasks.length > 0) {
          themeContent = contentTasks
            .map(task => task.ai_output || task.notes || '')
            .filter(content => content.trim())
            .join(' ')
            .substring(0, 1000);
        }

        // Get tenant personas for personalization
        const { data: personas, error: personasError } = await supabase
          .from('crm_personas')
          .select('persona_name, persona_description')
          .eq('tenant_id', tenant.tenant_id)
          .limit(3);

        const personaTags = personas?.map(p => p.persona_name) || ['Garden Enthusiast'];

        // Generate AI content
        const aiContent = await generateCampaignContent(theme, themeContent, personaTags);

        // Create auto-draft campaign
        const campaignData = {
          user_id: tenant.id,
          tenant_id: tenant.tenant_id,
          name: `${theme.title} – Week ${theme.week_number} Newsletter`,
          subject_line: aiContent.subjectLine,
          preheader_text: aiContent.preheader,
          status: 'draft',
          synced_from: theme.id,
          metadata: {
            auto_generated: true,
            auto_generated_at: new Date().toISOString(),
            theme_title: theme.title,
            week_number: theme.week_number,
            persona_tags: personaTags,
            suggested_send_time: aiContent.suggestedSendTime
          },
          scheduled_at: null,
          delivery_method: 'shared_sender'
        };

        const { data: newCampaign, error: createError } = await supabase
          .from('crm_campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (createError) {
          console.error(`❌ Error creating campaign for tenant ${tenant.tenant_id}:`, createError);
          errors.push(`Tenant ${tenant.tenant_id}: ${createError.message}`);
          continue;
        }

        console.log(`✅ Created auto-draft campaign for tenant ${tenant.tenant_id}: ${newCampaign.id}`);
        campaignsCreated++;

      } catch (tenantError) {
        console.error(`❌ Error processing tenant ${tenant.tenant_id}:`, tenantError);
        errors.push(`Tenant ${tenant.tenant_id}: ${tenantError.message}`);
      }
    }

    console.log(`🎉 Weekly campaign auto-generation completed. Created ${campaignsCreated} campaigns`);

    return new Response(JSON.stringify({ 
      success: true,
      campaignsCreated,
      errors: errors.length > 0 ? errors : undefined,
      processedDate: currentDate.toISOString(),
      weekNumber: currentWeek
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in auto-generate-weekly-campaigns function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function generateCampaignContent(theme: WeeklyTheme, content: string, personaTags: string[]) {
  const prompt = `Generate email campaign content for a garden center newsletter:

Theme: ${theme.title}
Week: ${theme.week_number}
Content Summary: ${content.substring(0, 500)}
Target Personas: ${personaTags.join(', ')}

Generate:
1. A compelling subject line (50 characters max, engaging and seasonal)
2. A preheader text (70 characters max, complementary to subject)
3. Suggested send time (format: "Tuesday 7:00 AM" or "Thursday 6:00 PM")

Consider:
- Fall planting season timing
- Garden center audience preferences
- High open rates for gardening content

Respond in JSON format:
{
  "subjectLine": "...",
  "preheader": "...",
  "suggestedSendTime": "..."
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert email marketing specialist for garden centers.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    try {
      return JSON.parse(aiResponse);
    } catch {
      // Fallback if JSON parsing fails
      return {
        subjectLine: `🌱 ${theme.title} - Week ${theme.week_number}`,
        preheader: 'Your weekly garden newsletter with seasonal tips and advice',
        suggestedSendTime: 'Tuesday 7:00 AM'
      };
    }
  } catch (error) {
    console.error('AI generation failed:', error);
    // Fallback content
    return {
      subjectLine: `🌱 ${theme.title} - Week ${theme.week_number}`,
      preheader: 'Your weekly garden newsletter with seasonal tips and advice',
      suggestedSendTime: 'Tuesday 7:00 AM'
    };
  }
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getStartOfWeek(date: Date): Date {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

serve(handler);