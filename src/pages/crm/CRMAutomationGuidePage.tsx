import React, { lazy, Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

const GuidedAutomationBuilder = lazy(() =>
  import('@/components/automation/GuidedAutomationBuilder').then(m => ({ default: m.GuidedAutomationBuilder }))
);

export const CRMAutomationGuidePage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

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
    const eventTriggers = new Set([
      'loyalty_join',
      'first_purchase',
      'customer_birthday',
      'big_spender',
      'abandoned_cart',
      'review_request',
      'event_rsvp',
      'newsletter_opt_in'
    ]);
    return eventTriggers.has(id) ? 'event' : 'manual';
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
      const triggerSubtype =
        config?.trigger ||
        config?.flow_data?.trigger_type ||
        config?.flow_data?.nodes?.find((n: any) => n?.type === 'trigger')?.data?.triggerType ||
        'manual';

      const payload: any = {
        name: config?.name || 'Untitled Automation',
        trigger_type: mapTriggerType(triggerSubtype),
        trigger_conditions: {
          ...(config?.trigger_conditions ?? {}),
          subtype: triggerSubtype
        },
        workflow_steps: config?.flow_data ?? [],
        is_active: false,
        user_id: user.id,
        ...(tenant?.id ? { tenant_id: tenant.id } : {})
      };

      const { data, error } = await supabase
        .from('crm_automations')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      toast({ title: 'Blueprint ready', description: 'Opening the canvas to continue designing.' });
      navigate(`/crm/automations/${data.id}/canvas`);
    } catch (err: any) {
      console.error('Failed to create automation draft', err?.message || err, err);
      toast({
        title: 'Could not create automation',
        description: 'Please try again.',
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
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading guide...</div>}>
            <GuidedAutomationBuilder
              onComplete={handleGuideComplete}
              onBack={() => window.history.back()}
            />
          </Suspense>
        </section>
      </main>
    </div>
  );
};
