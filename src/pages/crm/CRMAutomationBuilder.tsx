import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ReviewLaunchModal } from '@/components/automation/flow/ReviewLaunchModal';
import { AutomationFlowCanvas } from '@/components/automation/flow/AutomationFlowCanvas';
import { Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const GuidedAutomationBuilder = lazy(() => import('@/components/automation/GuidedAutomationBuilder').then(m => ({ default: m.GuidedAutomationBuilder })));

export const CRMAutomationBuilder = () => {
  const { automationId } = useParams();
  const [automationName, setAutomationName] = useState('New Automation');
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [flowState, setFlowState] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleGuideComplete = (automationConfig: any) => {
    if (automationConfig?.name) setAutomationName(automationConfig.name);
    if (automationConfig?.flow_data) setFlowState(automationConfig.flow_data);
    if (automationConfig?.audience) {
      setSelectedPersonas(automationConfig.audience.personas || []);
      setSelectedSegments(automationConfig.audience.segments || []);
    }
    toast({ title: 'Blueprint applied', description: 'We prefilled your canvas based on your selections.' });
    if (isMobile) setIsGuideOpen(false);
  };

  useEffect(() => {
    document.title = `${automationName} – Automation Builder`;
  }, [automationName]);

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

  // Helper to safely validate flow_state from DB
  type FlowState = { nodes: any[]; edges: any[] };
  const isFlowState = (value: any): value is FlowState => {
    return !!value && typeof value === 'object' && Array.isArray((value as any).nodes) && Array.isArray((value as any).edges);
  };

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
        
        // Load flow state if available and valid
        const rawFlow = (data as any).flow_state;
        if (isFlowState(rawFlow) && rawFlow.nodes.length > 0) {
          // Normalize edges to ensure proper format
          const normalizedEdges = rawFlow.edges.map((edge: any) => ({
            id: edge.id || `${edge.source || edge.from}-${edge.target || edge.to}`,
            source: edge.source || edge.from,
            target: edge.target || edge.to,
            ...edge
          }));
          setFlowState({ nodes: rawFlow.nodes, edges: normalizedEdges });
        } else if (data.workflow_steps) {
          // Try to load from workflow_steps (array or object format)
          const workflowSteps = data.workflow_steps as any;
          if (Array.isArray(workflowSteps) && workflowSteps.length > 0) {
            const reconstructedFlow = reconstructFlowFromWorkflowSteps(workflowSteps, data.trigger_type);
            setFlowState(reconstructedFlow);
          } else if (workflowSteps?.nodes && Array.isArray(workflowSteps.nodes)) {
            // workflow_steps is stored as object with nodes/edges
            const normalizedEdges = (workflowSteps.edges || []).map((edge: any) => ({
              id: edge.id || `${edge.source || edge.from}-${edge.target || edge.to}`,
              source: edge.source || edge.from,
              target: edge.target || edge.to,
              ...edge
            }));
            setFlowState({ 
              nodes: workflowSteps.nodes, 
              edges: normalizedEdges 
            });
          } else {
            console.log('No valid flow_state or workflow_steps found:', { rawFlow, workflow_steps: data.workflow_steps });
          }
        } else {
          console.log('No valid flow_state or workflow_steps found:', { rawFlow, workflow_steps: data.workflow_steps });
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

  // Helper to reconstruct flow from workflow_steps array
  const reconstructFlowFromWorkflowSteps = (steps: any[], triggerType: string) => {
    const nodes = [];
    const edges = [];
    
    // Add trigger node
    nodes.push({
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: { triggerType: triggerType || 'manual' }
    });

    let previousNodeId = 'trigger-1';
    
    // Add workflow step nodes
    steps.forEach((step, index) => {
      const nodeId = `${step.type}-${index + 1}`;
      nodes.push({
        id: nodeId,
        type: step.type,
        position: { x: 100, y: 200 + (index * 100) },
        data: { ...step }
      });
      
      // Connect to previous node
      edges.push({
        id: `${previousNodeId}-${nodeId}`,
        source: previousNodeId,
        target: nodeId
      });
      
      previousNodeId = nodeId;
    });

    return { nodes, edges };
  };

  // Map trigger IDs to database-accepted values
  const mapTriggerType = (triggerType?: string) => {
    if (!triggerType) return 'manual';
    
    const triggerMapping: Record<string, string> = {
      'loyalty_join': 'welcome',
      'first_purchase': 'welcome', 
      'customer_birthday': 'seasonal',
      'big_spender': 'purchase_delay',
      'abandoned_cart': 'purchase_delay',
      'review_request': 'purchase_delay',
      'event_rsvp': 'seasonal',
      'newsletter_opt_in': 'segment_joined',
      'newsletter_signup': 'segment_joined',
      'weekly_promotion': 'seasonal',
      'seasonal_campaign': 'seasonal',
      'inventory_clearance': 'manual',
      'plant_care_reminder': 'seasonal',
      'seasonal_tips': 'seasonal',
      'problem_solving': 'manual',
      'repeat_purchase_90d': 'purchase_delay',
      'repeat_purchase_180d': 'purchase_delay'
    };
    
    return triggerMapping[triggerType] || 'manual';
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in to save.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    const currentFlowState = flowState;
    const triggerNode = currentFlowState.nodes.find((n: any) => n.type === 'trigger');
    const payload: any = {
      name: automationName,
      is_active: false,
      trigger_type: mapTriggerType(triggerNode?.data.triggerType),
      trigger_conditions: {},
      workflow_steps: currentFlowState.nodes.filter(n => n.type !== 'trigger').length > 0 ? 
        currentFlowState.nodes.filter(n => n.type !== 'trigger').map(n => ({ type: n.type, ...n.data })) : [],
      flow_state: currentFlowState,
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
    const triggerNode = currentFlowState.nodes.find((n: any) => n.type === 'trigger');
    const payload: any = {
      name: automationName,
      is_active: true,
      trigger_type: mapTriggerType(triggerNode?.data.triggerType),
      trigger_conditions: {},
      workflow_steps: currentFlowState.nodes.filter(n => n.type !== 'trigger').length > 0 ? 
        currentFlowState.nodes.filter(n => n.type !== 'trigger').map(n => ({ type: n.type, ...n.data })) : [],
      flow_state: currentFlowState,
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

  // Determine if we should show the guide sidebar
  // Hide sidebar when editing existing automation or when flow has nodes
  const showGuideSidebar = !automationId ? flowState.nodes.length === 0 : false;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="sr-only">Automation Builder - {automationName}</h1>
            <Input
              value={automationName}
              onChange={(e) => setAutomationName(e.target.value)}
              placeholder="Automation name"
              aria-label="Automation name"
              className="h-9 w-[240px] sm:w-[320px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2"
              aria-label="Save draft"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            {!automationId && (
              <Button
                variant="secondary"
                onClick={() => setIsGuideOpen(true)}
                className={flowState.nodes.length === 0 ? "md:hidden" : ""}
              >
                Build with Guide
              </Button>
            )}
            <Button onClick={() => setIsReviewOpen(true)} aria-label="Review and launch">
              Review & Launch
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {!automationId && flowState.nodes.length === 0 && (
          <aside className="hidden md:block md:w-72 border-r p-4 overflow-y-auto">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading guide...</div>}>
              <GuidedAutomationBuilder 
                onComplete={handleGuideComplete}
                onBack={() => {}}
              />
            </Suspense>
          </aside>
        )}
        <main className="flex-1 overflow-y-auto">
          <AutomationFlowCanvas
            automationId={automationId}
            initialFlowState={flowState}
            onSave={setFlowState}
            onSaveDraft={handleSaveDraft}
            onReviewLaunch={() => setIsReviewOpen(true)}
            automationName={automationName}
            selectedPersonas={selectedPersonas}
            selectedSegments={selectedSegments}
            onPersonasChange={setSelectedPersonas}
            onSegmentsChange={setSelectedSegments}
          />
        </main>
      </div>

      <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>Guided Builder</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-56px)] overflow-y-auto p-4">
            <Suspense fallback={<div className="p-4 text-muted-foreground">Loading guide...</div>}>
              <GuidedAutomationBuilder onComplete={handleGuideComplete} onBack={() => setIsGuideOpen(false)} />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

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
