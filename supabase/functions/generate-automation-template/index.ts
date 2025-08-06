import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Import templates directly in edge function - can't access src/ directory
const TEMPLATES = {
  loyalty_join_sms: {
    name: 'Instant Loyalty SMS',
    trigger: 'loyalty_join',
    steps: [{
      delayHours: 0,
      channel: 'sms' as const,
      body: '🎉 Thanks for joining! Reply BUD to get 10% off your next purchase.',
      template_id: 'loyalty_join_sms-0'
    }]
  }
};

interface Step {
  delayHours: number;
  channel: 'sms' | 'email';
  body: string;
  template_id: string;
}

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
    const { trigger, businessName = 'Bloom Gardens' } = await req.json();

    if (!trigger) {
      return new Response(
        JSON.stringify({ error: 'Trigger is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First check if we have existing templates for this trigger
    const existingTemplates = Object.values(TEMPLATES).filter(t => t.trigger === trigger);
    if (existingTemplates.length > 0) {
      // Return the first matching template
      const template = existingTemplates[0];
      return new Response(
        JSON.stringify({
          name: template.name,
          steps: template.steps
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no existing template and no OpenAI key, return a basic template
    if (!openAIApiKey) {
      console.log('No OpenAI API key found, returning basic template');
      const basicTemplate = {
        name: `${trigger.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Automation`,
        steps: [{
          delayHours: 0,
          channel: 'email' as const,
          body: `Thank you for your engagement with ${businessName}! We appreciate your business.`,
          template_id: `ai-draft-${trigger}-${Date.now()}`
        }]
      };
      
      return new Response(
        JSON.stringify(basicTemplate),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate with AI
    const prompt = `Create an automation sequence for a garden center CRM when "${trigger}" occurs. 
    
Business: ${businessName}
Context: Garden center, plants, flowers, landscaping supplies

Generate 1-3 steps (mix of email and SMS) that would be appropriate for this trigger.
Focus on customer engagement, retention, and providing value.

Return ONLY a JSON object with this structure:
{
  "name": "Template Name",
  "steps": [
    {
      "delayHours": 0,
      "channel": "email" or "sms",
      "body": "Message content with merge variables like {{first_name}}",
      "template_id": "ai-generated-${trigger}-1"
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert in customer relationship management and marketing automation for retail businesses. Generate practical, engaging automation sequences.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    try {
      const generatedTemplate = JSON.parse(generatedContent);
      
      // Validate the structure
      if (!generatedTemplate.name || !Array.isArray(generatedTemplate.steps)) {
        throw new Error('Invalid template structure');
      }

      // Ensure template_id is set for each step
      generatedTemplate.steps = generatedTemplate.steps.map((step: any, index: number) => ({
        ...step,
        template_id: step.template_id || `ai-generated-${trigger}-${index + 1}`
      }));

      console.log('Generated template:', generatedTemplate);

      return new Response(
        JSON.stringify(generatedTemplate),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      
      // Fallback template
      const fallbackTemplate = {
        name: `AI Generated: ${trigger}`,
        steps: [{
          delayHours: 0,
          channel: 'email' as const,
          body: `Thank you for your interaction with ${businessName}. We'll be in touch soon!`,
          template_id: `ai-fallback-${trigger}-${Date.now()}`
        }]
      };

      return new Response(
        JSON.stringify(fallbackTemplate),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-automation-template function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});