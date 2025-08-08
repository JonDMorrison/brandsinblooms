import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ReviewLaunchModal } from '@/components/automation/flow/ReviewLaunchModal';
import { AutomationCanvas } from '@/components/automation/AutomationCanvas';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const CRMAutomationCanvasPage: React.FC = () => {
  const { id: automationId } = useParams();
  const [automationName, setAutomationName] = useState('New Automation');
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [flowState, setFlowState] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    document.title = `${automationName} – Automation Canvas`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Design and edit your automation on the canvas.');
  }, [automationName]);

  useEffect(() => {
    if (automationId) loadAutomation();
  }, [automationId]);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (!error) setTenantId(data?.tenant_id ?? null);
    };
    fetchTenant();
  }, [user?.id]);

  type FlowState = { nodes: any[]; edges: any[] };
  const isFlowState = (value: any): value is FlowState => !!value && typeof value === 'object' && Array.isArray(value.nodes) && Array.isArray(value.edges);

  const loadAutomation = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .eq('id', automationId)
        .single();
      if (error) throw error;
      if (data) {
        setAutomationName((data as any).name || 'Untitled Automation');
        const rawFlow = (data as any).flow_state;
        if (isFlowState(rawFlow)) setFlowState({ nodes: rawFlow.nodes, edges: rawFlow.edges });
      }
    } catch (e) {
      console.error('Error loading automation:', e);
      toast({ title: 'Error', description: 'Failed to load automation', variant: 'destructive' });
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in to save.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const payload: any = {
      name: automationName,
      is_active: false,
      trigger_type: flowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
      trigger_conditions: {},
      workflow_steps: [],
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      // flow_state: flowState,
    };
    try {
      if (automationId) {
        const { error } = await supabase.from('crm_automations').update(payload).eq('id', automationId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('crm_automations').insert(payload).select().single();
        if (error) throw error;
        if (data?.id) window.history.replaceState({}, '', `/crm/automations/${data.id}/canvas`);
      }
      toast({ title: 'Saved', description: 'Draft saved successfully.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save draft.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in to activate.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const payload: any = {
      name: automationName,
      is_active: true,
      trigger_type: flowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
      trigger_conditions: {},
      workflow_steps: [],
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      // flow_state: flowState,
    };
    try {
      if (automationId) {
        const { error } = await supabase.from('crm_automations').update(payload).eq('id', automationId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_automations').insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Activated', description: 'Automation has been activated successfully.' });
      setIsReviewOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to activate automation.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="sr-only">Automation Canvas - {automationName}</h1>
            <Input
              value={automationName}
              onChange={(e) => setAutomationName(e.target.value)}
              placeholder="Automation name"
              aria-label="Automation name"
              className="h-9 w-[240px] sm:w-[320px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving} className="flex items-center gap-2" aria-label="Save draft">
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <AudienceTargetingButton
              selectedPersonas={selectedPersonas}
              selectedSegments={selectedSegments}
              onPersonasChange={setSelectedPersonas}
              onSegmentsChange={setSelectedSegments}
            />
            <Button onClick={() => setIsReviewOpen(true)} aria-label="Review and launch">Review & Launch</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <AutomationCanvas flowState={flowState} onFlowStateChange={setFlowState} />
      </main>

      <ReviewLaunchModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        automation={{
          name: automationName,
          triggerType: flowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
          flowSteps: [],
          selectedAudience: { personas: selectedPersonas, segments: selectedSegments, totalContacts: 0 },
        }}
        onLaunch={handleActivate}
        onTestSend={() => {}}
        isLoading={isSaving}
      />
    </div>
  );
};
