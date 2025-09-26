import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AutomationPresets } from '@/components/automation/AutomationPresets';
import { getTemplatesForTrigger } from '@/lib/campaignTemplates';

const GuidedAutomationBuilder = lazy(() =>
  import('@/components/automation/GuidedAutomationBuilder').then(m => ({ default: m.GuidedAutomationBuilder }))
);

export const CRMAutomationGuidePage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [showPresets, setShowPresets] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<any>(null);

  useEffect(() => {
    document.title = 'Build Your Custom Automation – Guide';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Build your custom automation with guided steps.');
    // Canonical tag for SEO
    const existing = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalUrl = `${window.location.origin}/crm/automations/new/guide`;
    if (existing) {
      existing.href = canonicalUrl;
    } else {
      const link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', canonicalUrl);
      document.head.appendChild(link);
    }
  }, []);

  // Normalize builder trigger IDs to backend-accepted categories
  const mapTriggerType = (id?: string) => {
    if (!id) return 'manual';
    
    // Map specific event triggers to appropriate database values
    const triggerMapping: Record<string, string> = {
      'loyalty_join': 'welcome',
      'first_purchase': 'welcome', 
      'customer_birthday': 'seasonal',
      'big_spender': 'purchase_delay',
      'abandoned_cart': 'purchase_delay',
      'review_request': 'purchase_delay',
      'event_rsvp': 'seasonal',
      'newsletter_opt_in': 'segment_joined'
    };
    
    return triggerMapping[id] || 'manual';
  };

  const handlePresetSelection = async (preset: any) => {
    if (preset.id === 'customer_loyalty_program') {
      // Get the template for loyalty program
      const templates = getTemplatesForTrigger('loyalty_members_segment');
      const loyaltyTemplate = templates.find(t => t.name.includes('Customer Loyalty Program'));
      
      if (loyaltyTemplate) {
        // Create automation directly with preset configuration
        const automationConfig = {
          name: preset.title,
          description: preset.description,
          trigger: 'loyalty_members_segment',
          trigger_conditions: {
            segment_id: 'loyalty-members', // Built-in Loyalty Members segment
            subtype: 'loyalty_members_segment'
          },
          workflow_steps: loyaltyTemplate.steps.map((step, index) => ({
            step_number: index + 1,
            delay_hours: step.delayHours || 0,
            channel: step.channel,
            message_content: step.body,
            template_id: step.template_id
          })),
          template_source: 'customer_loyalty_program'
        };
        
        await handleGuideComplete(automationConfig);
      }
    } else {
      setSelectedPreset(preset);
      setShowPresets(false);
    }
  };

  const handleGuideComplete = async (config?: any) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create an automation.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Resolve tenant ID robustly
      let tenantId = tenant?.id;
      if (!tenantId) {
        console.warn('No tenant found, fetching user tenant...');
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (userError) {
          console.error('Failed to fetch user tenant:', userError);
          throw new Error('Unable to determine workspace. Please try again.');
        }
        tenantId = userData?.tenant_id;
      }

      if (!tenantId) {
        throw new Error('No workspace found. Please contact support.');
      }

      // Extract trigger information
      const triggerSubtype =
        config?.trigger ||
        config?.flow_data?.trigger_type ||
        config?.flow_data?.nodes?.find((n: any) => n?.type === 'trigger')?.data?.triggerType ||
        'manual';

      // Map trigger type correctly
      const triggerType = mapTriggerType(triggerSubtype);

      // Build complete payload
      const payload = {
        name: config?.name || 'Untitled Automation',
        trigger_type: triggerType,
        trigger_conditions: {
          ...(config?.trigger_conditions ?? {}),
          subtype: triggerSubtype
        },
        flow_state: config?.flow_data || null,
        workflow_steps: config?.workflow_steps || config?.flow_data || [],
        template_source: config?.template_key || null,
        is_active: false,
        user_id: user.id,
        tenant_id: tenantId
      };

      console.log('Creating automation with payload:', payload);

      const { data, error } = await supabase
        .from('crm_automations')
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({ 
        title: 'Automation created successfully', 
        description: 'Opening the canvas to continue designing.' 
      });
      
      navigate(`/crm/automations/${data.id}`);

    } catch (err: any) {
      console.error('Failed to create automation:', err);
      
      let errorMessage = 'Please try again.';
      if (err?.message?.includes('row-level security')) {
        errorMessage = 'Permission denied. Please check your workspace access.';
      } else if (err?.message?.includes('workspace') || err?.message?.includes('tenant')) {
        errorMessage = err.message;
      } else if (err?.message?.includes('violates check constraint')) {
        errorMessage = 'Invalid automation data. Please review your settings.';
      }

      toast({
        title: 'Failed to create automation',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold text-foreground">Build Your Custom Automation</h1>
          <Link to="/crm/automations/new/canvas" aria-label="Switch to Canvas">
            <Button variant="outline">Switch to Canvas</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="max-w-5xl mx-auto p-4 md:p-6">
          {showPresets ? (
            <AutomationPresets
              onSelectPreset={handlePresetSelection}
              onCreateCustom={() => setShowPresets(false)}
            />
          ) : (
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading guide...</div>}>
              <GuidedAutomationBuilder
                onComplete={handleGuideComplete}
                onBack={() => setShowPresets(true)}
              />
            </Suspense>
          )}
        </section>
      </main>
    </div>
  );
};
