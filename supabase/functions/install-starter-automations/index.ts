import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Starter pack template definitions
interface StarterTemplate {
  id: string;
  name: string;
  trigger: string;
  description: string;
  workflow_steps: Array<{
    type: 'email' | 'sms';
    delayMin: number;
    subject?: string;
    text: string;
  }>;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter_welcome_first_purchase',
    name: 'Welcome Series (First Purchase)',
    trigger: 'first_purchase',
    description: 'Welcome new customers after their first purchase',
    workflow_steps: [
      {
        type: 'email',
        delayMin: 0,
        subject: 'Welcome to the Garden Club 🌿',
        text: 'Hi {{ first_name | default: "Friend" }}!\n\nThanks for your first purchase! We\'re so glad you\'ve joined our gardening community.\n\nHere\'s what to expect as a member of our garden family...'
      },
      {
        type: 'email',
        delayMin: 1440, // 24 hours
        subject: 'Care Tips for Your New Plants',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nHere are some helpful care tips for your recent purchase. Remember, every plant is unique and these guidelines will help you keep them thriving!'
      },
      {
        type: 'sms',
        delayMin: 4320, // 3 days
        text: 'Hi {{ first_name | default: "Friend" }}! How are your plants doing? Reply with questions anytime. Text STOP to opt out.'
      },
      {
        type: 'email',
        delayMin: 10080, // 7 days
        subject: '$5 Off Your Next Visit',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nAs a thank you for being part of our community, here\'s $5 off your next visit!\n\nUse code WELCOME5 on your next purchase.'
      }
    ]
  },
  {
    id: 'starter_loyalty_onboarding',
    name: 'Loyalty Program Onboarding',
    trigger: 'loyalty_join',
    description: 'Onboard new loyalty program members',
    workflow_steps: [
      {
        type: 'email',
        delayMin: 0,
        subject: 'You\'re In! How Your Points Work',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nWelcome to our loyalty program! You\'ll earn points on every purchase.\n\nHow it works: Earn 1 point for every $1 spent. Redeem 100 points for $5 off.'
      },
      {
        type: 'email',
        delayMin: 10080, // 7 days
        subject: 'Double Points This Weekend',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nShop this Friday through Sunday and earn 2x points on every purchase!'
      },
      {
        type: 'sms',
        delayMin: 43200, // 30 days
        text: 'Hi {{ first_name | default: "Friend" }}! You\'ve got points waiting—redeem them this week! Text STOP to opt out.'
      }
    ]
  },
  {
    id: 'starter_winback_90d',
    name: '90-Day Winback',
    trigger: 'repeat_purchase_90d',
    description: 'Re-engage customers who haven\'t purchased in 90 days',
    workflow_steps: [
      {
        type: 'email',
        delayMin: 0,
        subject: 'We Miss You—See What\'s New 🌱',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nIt\'s been a while since we\'ve seen you! We\'ve got fresh perennials and indoor plants just in that we think you\'ll love.'
      },
      {
        type: 'sms',
        delayMin: 2880, // 2 days
        text: 'Hi {{ first_name | default: "Friend" }}! Pop in this week for a fresh look—new arrivals daily. Text STOP to opt out.'
      },
      {
        type: 'email',
        delayMin: 10080, // 7 days
        subject: 'A Little Nudge: 10% Off',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nWe\'d love to see you again! Here\'s 10% off to welcome you back.\n\nUse code COMEHOME10 on your next visit.'
      }
    ]
  },
  {
    id: 'starter_birthday',
    name: 'Birthday Offer',
    trigger: 'birthday',
    description: 'Send birthday wishes and special offers',
    workflow_steps: [
      {
        type: 'email',
        delayMin: -10080, // 7 days before birthday
        subject: 'Your Birthday Month Treat 🎉',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nYour birthday is coming up and we want to celebrate with you! Enjoy 20% off any purchase this month.'
      },
      {
        type: 'sms',
        delayMin: 0, // On birthday
        text: 'Happy Birthday {{ first_name | default: "Friend" }}! 🎂 Enjoy 20% off today. Text STOP to opt out.'
      }
    ]
  },
  {
    id: 'starter_abandoned_cart',
    name: 'Abandoned Cart Recovery',
    trigger: 'abandoned_cart',
    description: 'Recover abandoned shopping carts (requires POS integration)',
    workflow_steps: [
      {
        type: 'email',
        delayMin: 30, // 30 minutes
        subject: 'You Left Something in Your Cart',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nLooks like you left some items behind! Your cart is waiting for you.\n\nClick here to complete your order.'
      },
      {
        type: 'sms',
        delayMin: 1440, // 24 hours
        text: 'Hi {{ first_name | default: "Friend" }}! Still want those items? Reply if you need help. Text STOP to opt out.'
      }
    ]
  },
  {
    id: 'starter_seasonal_nurture',
    name: 'Seasonal Care & Promotions',
    trigger: 'plant_care_reminder',
    description: 'Send seasonal care tips and promote workshops',
    workflow_steps: [
      {
        type: 'email',
        delayMin: 0,
        subject: 'Seasonal Tips: Get Your Garden Ready',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nThe season is changing and it\'s the perfect time to prepare your garden! Here are some tips to help your plants thrive.'
      },
      {
        type: 'email',
        delayMin: 4320, // 3 days
        subject: 'Join Our Workshop This Week',
        text: 'Hi {{ first_name | default: "Friend" }},\n\nWe\'re hosting a hands-on workshop this week! Reserve your spot and learn expert gardening techniques.'
      }
    ]
  }
];

// Helper function to create flow state from workflow steps
function createFlowStateFromSteps(triggerId: string, steps: any[]): any {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Create trigger node
  const triggerNode = {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      triggerType: triggerId,
      label: `Trigger: ${triggerId}`,
    }
  };
  nodes.push(triggerNode);

  let lastNodeId = triggerNode.id;
  let yPosition = 200;

  // Create nodes for each step
  steps.forEach((step, index) => {
    const stepNodeId = `${step.type}-${index + 1}`;

    // Add delay node if there's a delay
    if (step.delayMin > 0) {
      const delayNodeId = `delay-${index + 1}`;
      const delayNode = {
        id: delayNodeId,
        type: 'delay',
        position: { x: 100, y: yPosition },
        data: {
          delayValue: Math.max(1, Math.floor(step.delayMin / 60)), // Convert to hours, minimum 1
          delayUnit: step.delayMin >= 1440 ? 'days' : 'hours'
        }
      };
      nodes.push(delayNode);

      // Connect last node to delay
      edges.push({
        id: `${lastNodeId}-${delayNodeId}`,
        source: lastNodeId,
        target: delayNodeId,
      });

      lastNodeId = delayNodeId;
      yPosition += 100;
    }

    // Create step node
    const stepNode = {
      id: stepNodeId,
      type: step.type,
      position: { x: 100, y: yPosition },
      data: step.type === 'email' ? {
        subject: step.subject,
        body: step.text
      } : {
        content: step.text
      }
    };
    nodes.push(stepNode);

    // Connect to step
    edges.push({
      id: `${lastNodeId}-${stepNodeId}`,
      source: lastNodeId,
      target: stepNodeId,
    });

    lastNodeId = stepNodeId;
    yPosition += 100;
  });

  return { nodes, edges };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 Installing starter automation pack...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body for tenant_id (optional)
    let requestBody: any = {};
    try {
      if (req.body) {
        requestBody = await req.json();
      }
    } catch (e) {
      // No body is fine, we'll get tenant from auth
    }

    const tenantId = requestBody.tenant_id;
    
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }

    // Check if starter pack is already installed
    const { data: existingStarterPack, error: checkError } = await supabase
      .from('crm_automations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('template_source', 'starter_pack:v1')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking existing starter pack:', checkError);
      throw checkError;
    }

    if (existingStarterPack && existingStarterPack.length > 0) {
      console.log('✅ Starter pack already installed, skipping');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Starter pack already installed',
          installed: 0,
          existing: existingStarterPack.length
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Prepare automation records for insertion
    const automationInserts = STARTER_TEMPLATES.map(template => {
      const flowState = createFlowStateFromSteps(template.trigger, template.workflow_steps);
      
      return {
        tenant_id: tenantId,
        name: template.name,
        description: template.description,
        is_active: false,
        trigger_type: template.trigger,
        trigger_conditions: {},
        workflow_steps: template.workflow_steps,
        flow_state: flowState,
        template_source: 'starter_pack:v1',
        version: 1,
        compiled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Insert all starter automations
    const { data: insertedAutomations, error: insertError } = await supabase
      .from('crm_automations')
      .insert(automationInserts)
      .select('id, name');

    if (insertError) {
      console.error('❌ Error inserting starter automations:', insertError);
      throw insertError;
    }

    console.log(`✅ Successfully installed ${insertedAutomations?.length || 0} starter automations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Starter automation pack installed successfully',
        installed: insertedAutomations?.length || 0,
        automations: insertedAutomations?.map((a: any) => ({ id: a.id, name: a.name })) || []
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('💥 Install starter automations error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);