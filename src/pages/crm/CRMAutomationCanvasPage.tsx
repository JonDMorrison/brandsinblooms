
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ReviewLaunchModal } from '@/components/automation/flow/ReviewLaunchModal';
import { AutomationFlowCanvas } from '@/components/automation/flow/AutomationFlowCanvas';
import { Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import { ConflictBanner } from '@/components/autosave/ConflictBanner';
import { AutoSaveIndicator } from '@/components/crm/AutoSaveIndicator';

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
        const ws = (data as any).workflow_steps;
        if (isFlowState(ws)) {
          setFlowState({ nodes: ws.nodes, edges: ws.edges });
        } else {
          const subtype = (data as any)?.trigger_conditions?.subtype || (data as any)?.trigger_type || 'manual';
          const initial: FlowState = {
            nodes: [
              {
                id: 'trigger-1',
                type: 'trigger',
                position: { x: 160, y: 80 },
                data: { label: String(subtype).replace(/_/g, ' '), triggerType: subtype },
              },
            ],
            edges: [],
          };
          setFlowState(initial);
        }
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
      trigger_type: 'manual',
      trigger_conditions: {},
      workflow_steps: flowState,
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
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
      trigger_type: 'manual',
      trigger_conditions: {},
      workflow_steps: flowState,
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
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

  // Merge-safe autosave: only if we have a real automationId (UUID)
  const autosaveEnabled = useMemo(() => Boolean(automationId), [automationId]);

  const { status: autoStatus, lastSavedAt, conflicts, scheduleSave, saveNow, clearConflicts } = useDraftAutosave({
    docType: 'automation',
    docId: autosaveEnabled ? automationId! : null,
    throttleMs: 5000,
    onHeadNotice: ({ version }) => {
      console.log('Head changed to version', version);
    }
  });

  // Schedule autosave whenever flowState changes
  useEffect(() => {
    if (!autosaveEnabled) return;
    scheduleSave(flowState);
  }, [autosaveEnabled, flowState, scheduleSave]);

  // Flush autosave on unmount
  useEffect(() => {
    return () => {
      if (autosaveEnabled) {
        void saveNow(flowState);
      }
    };
  }, [autosaveEnabled, flowState, saveNow]);

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
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <AutoSaveIndicator
                status={
                  autoStatus === 'saving' ? 'saving' :
                  autoStatus === 'error' ? 'error' : 'saved'
                }
                onRetry={() => saveNow(flowState)}
              />
              {lastSavedAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  Last saved {Math.round((Date.now() - lastSavedAt) / 1000)}s ago
                </div>
              )}
            </div>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving} className="flex items-center gap-2" aria-label="Save draft">
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={() => setIsReviewOpen(true)} aria-label="Review and launch">Review & Launch</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {conflicts.length > 0 && (
          <div className="max-w-5xl mx-auto p-4">
            <ConflictBanner
              conflicts={conflicts}
              onAcceptMerged={() => clearConflicts()}
              onDiscardBanner={() => clearConflicts()}
              onViewDiff={() => {
                // Simple diff view: log to console for now
                console.log('Conflicts:', conflicts);
                toast({ title: 'Conflict details logged', description: 'Open the console to inspect field-level differences.' });
              }}
            />
          </div>
        )}

        <AutomationFlowCanvas
          automationId={automationId}
          initialFlowState={flowState as any}
          onSave={(state) => setFlowState(state as any)}
          onSaveDraft={handleSaveDraft}
          onReviewLaunch={() => setIsReviewOpen(true)}
          automationName={automationName}
          triggerType="manual"
          selectedPersonas={selectedPersonas}
          selectedSegments={selectedSegments}
          onPersonasChange={setSelectedPersonas}
          onSegmentsChange={setSelectedSegments}
        />
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
