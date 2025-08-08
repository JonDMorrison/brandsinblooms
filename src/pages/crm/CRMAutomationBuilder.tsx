import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ReviewLaunchModal } from '@/components/automation/flow/ReviewLaunchModal';
import { AutomationCanvas } from '@/components/automation/AutomationCanvas';
import { GuidedAutomationBuilder } from '@/components/automation/GuidedAutomationBuilder';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const CRMAutomationBuilder = () => {
  const { id: automationId } = useParams();
  const [automationName, setAutomationName] = useState('New Automation');
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [flowState, setFlowState] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Load existing automation if editing
  useEffect(() => {
    if (automationId) {
      loadAutomation();
    }
  }, [automationId]);

  // Fetch tenant ID for RLS-compliant inserts/updates
  useEffect(() => {
    const fetchTenant = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (!error) {
        setTenantId(data?.tenant_id ?? null);
      } else {
        console.error('Failed to fetch tenant_id:', error);
      }
    };
    fetchTenant();
  }, [user?.id]);

  const loadAutomation = async () => {
    if (!automationId) return;
    
    try {
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .eq('id', automationId)
        .single();

      if (error) {
        console.error('Error loading automation:', error);
        toast({
          title: 'Error',
          description: 'Failed to load automation',
          variant: 'destructive'
        });
        return;
      }

      if (data) {
        setAutomationName(data.name || 'Untitled Automation');
        // Load flow state if available
        if (data.flow_state) {
          setFlowState(data.flow_state);
        }
      }
    } catch (error) {
      console.error('Error loading automation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load automation',
        variant: 'destructive'
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in to save.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    const currentFlowState = flowState;
    const payload: any = {
      name: automationName,
      is_active: false,
      trigger_type: currentFlowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
      trigger_conditions: {},
      workflow_steps: [],
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    try {
      if (automationId) {
        const { error } = await supabase
          .from('crm_automations')
          .update(payload)
          .eq('id', automationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('crm_automations')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        
        // Update the URL to include the new automation ID
        if (data?.id) {
          window.history.replaceState({}, '', `/crm/automations/${data.id}`);
        }
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

    const currentFlowState = flowState;
    const payload: any = {
      name: automationName,
      is_active: true,
      trigger_type: currentFlowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
      trigger_conditions: {},
      workflow_steps: [],
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    try {
      if (automationId) {
        const { error } = await supabase
          .from('crm_automations')
          .update(payload)
          .eq('id', automationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('crm_automations')
          .insert(payload)
          .select()
          .single();

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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={automationName}
            onChange={(e) => setAutomationName(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none"
            placeholder="Automation Name"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <AudienceTargetingButton
            selectedPersonas={selectedPersonas}
            selectedSegments={selectedSegments}
            onPersonasChange={setSelectedPersonas}
            onSegmentsChange={setSelectedSegments}
          />
          <Button
            onClick={() => setIsReviewOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            Review & Launch
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-64 border-r p-4">
          <GuidedAutomationBuilder />
        </div>
        <div className="flex-1">
          <AutomationCanvas
            flowState={flowState}
            onFlowStateChange={setFlowState}
          />
        </div>
      </div>

      <ReviewLaunchModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        automation={{
          name: automationName,
          triggerType: flowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
          flowSteps: [],
          selectedAudience: {
            personas: selectedPersonas,
            segments: selectedSegments,
            totalContacts: 0,
          },
        }}
        onLaunch={handleActivate}
        onTestSend={() => {}}
        isLoading={isSaving}
      />
    </div>
  );
};
