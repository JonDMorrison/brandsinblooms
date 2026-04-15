import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { useToast } from "@/hooks/use-toast";
import { ReviewLaunchModal } from "@/components/automation/flow/ReviewLaunchModal";
import { AutomationFlowCanvas } from "@/components/automation/flow/AutomationFlowCanvas";
import { FlowStatusBadge } from "@/components/automation/flow/FlowValidation";
import { AudienceSelector } from "@/components/crm/AudienceSelector";
import { Save, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  extractTriggerConditions,
  validateTriggerConditions,
} from "@/lib/automation/extractTriggerConditions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui-legacy/sheet";

const GuidedAutomationBuilder = lazy(() =>
  import("@/components/automation/GuidedAutomationBuilder").then((m) => ({
    default: m.GuidedAutomationBuilder,
  })),
);

export const CRMAutomationBuilder = () => {
  const { automationId } = useParams();
  const location = useLocation();
  // If user navigated directly to canvas route, don't show the guide sidebar
  const isDirectCanvasRoute =
    location.pathname === "/crm/automations/new/canvas";
  const [automationName, setAutomationName] = useState("New Automation");
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [flowState, setFlowState] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: [],
  });
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  const [showAudienceSelector, setShowAudienceSelector] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideCompleted, setGuideCompleted] = useState(false);

  const handleGuideComplete = (automationConfig: any) => {
    if (automationConfig?.name) setAutomationName(automationConfig.name);
    if (automationConfig?.flow_data) setFlowState(automationConfig.flow_data);
    if (automationConfig?.audience) {
      setSelectedPersonas(automationConfig.audience.personas || []);
      setSelectedSegments(automationConfig.audience.segments || []);
    }
    toast({
      title: "Blueprint applied",
      description: "We prefilled your canvas based on your selections.",
    });
    // Close guide sheet and mark guide as completed to hide sidebar
    setIsGuideOpen(false);
    setGuideCompleted(true);
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
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!error) {
        setTenantId(data?.tenant_id ?? null);
      } else {
        console.error("Failed to fetch tenant_id:", error);
      }
    };
    fetchTenant();
  }, [user?.id]);

  // Helper to safely validate flow_state from DB
  type FlowState = { nodes: any[]; edges: any[] };
  const isFlowState = (value: any): value is FlowState => {
    return (
      !!value &&
      typeof value === "object" &&
      Array.isArray((value as any).nodes) &&
      Array.isArray((value as any).edges)
    );
  };

  const loadAutomation = async () => {
    if (!automationId) return;

    try {
      const { data, error } = await supabase
        .from("crm_automations")
        .select("*")
        .eq("id", automationId)
        .single();

      if (error) {
        console.error("Error loading automation:", error);
        toast({
          title: "Error",
          description: "Failed to load automation",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setAutomationName(data.name || "Untitled Automation");

        // Load flow state if available and valid
        const rawFlow = (data as any).flow_state;
        if (isFlowState(rawFlow) && rawFlow.nodes.length > 0) {
          // Normalize edges to ensure proper format
          const normalizedEdges = rawFlow.edges.map((edge: any) => ({
            id:
              edge.id ||
              `${edge.source || edge.from}-${edge.target || edge.to}`,
            source: edge.source || edge.from,
            target: edge.target || edge.to,
            ...edge,
          }));
          setFlowState({ nodes: rawFlow.nodes, edges: normalizedEdges });
        } else if (data.workflow_steps) {
          // Try to load from workflow_steps (array or object format)
          const workflowSteps = data.workflow_steps as any;
          if (Array.isArray(workflowSteps) && workflowSteps.length > 0) {
            const reconstructedFlow = reconstructFlowFromWorkflowSteps(
              workflowSteps,
              data.trigger_type,
            );
            setFlowState(reconstructedFlow);
          } else if (
            workflowSteps?.nodes &&
            Array.isArray(workflowSteps.nodes)
          ) {
            // workflow_steps is stored as object with nodes/edges
            const normalizedEdges = (workflowSteps.edges || []).map(
              (edge: any) => ({
                id:
                  edge.id ||
                  `${edge.source || edge.from}-${edge.target || edge.to}`,
                source: edge.source || edge.from,
                target: edge.target || edge.to,
                ...edge,
              }),
            );
            setFlowState({
              nodes: workflowSteps.nodes,
              edges: normalizedEdges,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading automation:", error);
      toast({
        title: "Error",
        description: "Failed to load automation",
        variant: "destructive",
      });
    }
  };

  // Helper to reconstruct flow from workflow_steps array
  const reconstructFlowFromWorkflowSteps = (
    steps: any[],
    triggerType: string,
  ) => {
    const nodes = [];
    const edges = [];

    // Add trigger node
    nodes.push({
      id: "trigger-1",
      type: "trigger",
      position: { x: 100, y: 100 },
      data: { triggerType: triggerType || "manual" },
    });

    let previousNodeId = "trigger-1";

    // Add workflow step nodes
    steps.forEach((step, index) => {
      const nodeId = `${step.type}-${index + 1}`;
      nodes.push({
        id: nodeId,
        type: step.type,
        position: { x: 100, y: 200 + index * 100 },
        data: { ...step },
      });

      // Connect to previous node
      edges.push({
        id: `${previousNodeId}-${nodeId}`,
        source: previousNodeId,
        target: nodeId,
      });

      previousNodeId = nodeId;
    });

    return { nodes, edges };
  };

  // Map trigger IDs to database-accepted values
  const mapTriggerType = (triggerType?: string) => {
    if (!triggerType) return "manual";

    // If the trigger type is already a valid DB trigger type, keep it as-is.
    // This prevents dropping canvas/trigger-specific types like 'segment.added' into 'manual'.
    const passthroughTriggerTypes = new Set([
      "manual",
      "welcome",
      "purchase_delay",
      "seasonal",
      "segment_joined",
      "segment.added",
      "segment_added",
      "persona.assigned",
      "persona_assigned",
      "loyalty_members.segment_added",
      "payment.completed",
      "first_purchase",
      "loyalty_join",
      "abandoned_cart",
      "review_request",
      "refund.created",
      "order.ready_for_pickup",
      "order.shipped",
      "repeat_purchase_90d",
      "birthday",
      "contact.created",
      "contact.updated",
    ]);

    if (passthroughTriggerTypes.has(triggerType)) return triggerType;

    const triggerMapping: Record<string, string> = {
      loyalty_join: "welcome",
      first_purchase: "welcome",
      customer_birthday: "seasonal",
      big_spender: "purchase_delay",
      abandoned_cart: "purchase_delay",
      review_request: "purchase_delay",
      event_rsvp: "seasonal",
      newsletter_opt_in: "segment_joined",
      newsletter_signup: "segment_joined",
      weekly_promotion: "seasonal",
      seasonal_campaign: "seasonal",
      inventory_clearance: "manual",
      plant_care_reminder: "seasonal",
      seasonal_tips: "seasonal",
      problem_solving: "manual",
      repeat_purchase_90d: "purchase_delay",
      repeat_purchase_180d: "purchase_delay",
    };

    return triggerMapping[triggerType] || "manual";
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      toast({
        title: "Not signed in",
        description: "Please sign in to save.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);

    const currentFlowState = flowState;
    const triggerNode = currentFlowState.nodes.find(
      (n: any) => n.type === "trigger",
    );
    const triggerSubtype = String(triggerNode?.data?.triggerType || "manual");
    const triggerConditions = {
      ...extractTriggerConditions(currentFlowState),
      subtype: triggerSubtype,
    };

    const overlapBehavior = String(
      triggerNode?.data?.overlapBehavior || "ignore",
    );

    const payload: any = {
      name: automationName,
      is_active: false,
      trigger_type: mapTriggerType(triggerSubtype),
      trigger_conditions: triggerConditions,
      overlap_behavior: overlapBehavior,
      workflow_steps:
        currentFlowState.nodes.filter((n) => n.type !== "trigger").length > 0
          ? currentFlowState.nodes
              .filter((n) => n.type !== "trigger")
              .map((n) => ({ type: n.type, ...n.data }))
          : [],
      flow_state: currentFlowState,
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    try {
      if (automationId) {
        const { error } = await supabase
          .from("crm_automations")
          .update(payload)
          .eq("id", automationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("crm_automations")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        // Update the URL to include the new automation ID
        if (data?.id) {
          window.history.replaceState({}, "", `/crm/automations/${data.id}`);
        }
      }
      toast({ title: "Saved", description: "Draft saved successfully." });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to save draft.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!user?.id) {
      toast({
        title: "Not signed in",
        description: "Please sign in to activate.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const currentFlowState = flowState;
    const triggerNode = currentFlowState.nodes.find(
      (n: any) => n.type === "trigger",
    );
    const triggerSubtype = String(triggerNode?.data?.triggerType || "manual");
    const triggerConditions = {
      ...extractTriggerConditions(currentFlowState),
      subtype: triggerSubtype,
    };

    const mappedTriggerType = mapTriggerType(triggerSubtype);
    const overlapBehavior = String(
      triggerNode?.data?.overlapBehavior || "ignore",
    );

    // Validate trigger conditions before activating
    const validation = validateTriggerConditions(
      mappedTriggerType,
      triggerConditions,
    );
    if (!validation.valid) {
      toast({
        title: "Missing Configuration",
        description:
          validation.message || "Please complete the trigger configuration.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    const payload: any = {
      name: automationName,
      is_active: true,
      trigger_type: mappedTriggerType,
      trigger_conditions: triggerConditions,
      overlap_behavior: overlapBehavior,
      workflow_steps:
        currentFlowState.nodes.filter((n) => n.type !== "trigger").length > 0
          ? currentFlowState.nodes
              .filter((n) => n.type !== "trigger")
              .map((n) => ({ type: n.type, ...n.data }))
          : [],
      flow_state: currentFlowState,
      user_id: user?.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    try {
      if (automationId) {
        const { error } = await supabase
          .from("crm_automations")
          .update(payload)
          .eq("id", automationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("crm_automations")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
      }

      toast({
        title: "Activated",
        description: "Automation has been activated successfully.",
      });
      setIsReviewOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to activate automation.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if we should show the guide sidebar
  // Hide sidebar when editing existing automation or when flow has nodes
  const showGuideSidebar = !automationId ? flowState.nodes.length === 0 : false;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
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
              {isSaving ? "Saving..." : "Save Draft"}
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
            <div className="flex items-center gap-2">
              <FlowStatusBadge
                nodes={flowState.nodes}
                edges={flowState.edges}
                selectedAudience={{
                  personas: selectedPersonas,
                  segments: selectedSegments,
                  totalContacts: selectedSegments.reduce(
                    (total, segment) => total + (segment.customer_count || 0),
                    0,
                  ),
                }}
                onAddTrigger={() => {
                  const triggerNode = {
                    id: "trigger-1",
                    type: "trigger",
                    position: { x: 250, y: 50 },
                    data: {
                      label: "Trigger",
                      triggerType: "manual",
                      description: "Manual trigger",
                    },
                  };
                  setFlowState((prev) => ({
                    ...prev,
                    nodes: [
                      ...prev.nodes.filter((n) => n.type !== "trigger"),
                      triggerNode,
                    ],
                  }));
                  toast({
                    title: "Trigger Added",
                    description: "A trigger node has been added to your flow.",
                  });
                }}
                onOpenAudienceSelector={() => setShowAudienceSelector(true)}
                onEditNode={(nodeId) => {
                  // For now, show a toast - this would need integration with the node editor
                  const node = flowState.nodes.find((n) => n.id === nodeId);
                  toast({
                    title: "Edit Node",
                    description: `Please click on the ${node?.type || "node"} in the canvas to edit it.`,
                  });
                }}
                onHighlightNodes={(nodeIds) => {
                  // For now, show a toast with the nodes to highlight
                  toast({
                    title: "Nodes Need Attention",
                    description: `${nodeIds.length} disconnected node(s) found. Look for unconnected nodes in your flow.`,
                  });
                }}
              />
              <Button
                onClick={() => setIsReviewOpen(true)}
                aria-label="Review and launch"
              >
                Review & Launch
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {!automationId &&
          flowState.nodes.length === 0 &&
          !guideCompleted &&
          !isDirectCanvasRoute && (
            <aside className="hidden md:block md:w-80 border-r p-6 overflow-y-auto">
              <Suspense
                fallback={
                  <div className="text-sm text-muted-foreground">
                    Loading guide...
                  </div>
                }
              >
                <GuidedAutomationBuilder
                  onComplete={handleGuideComplete}
                  onBack={() => {}}
                />
              </Suspense>
            </aside>
          )}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
            className="flex-1 min-h-0"
          />
        </main>
      </div>

      <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>Guided Builder</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-56px)] overflow-y-auto p-4">
            <Suspense
              fallback={
                <div className="p-4 text-muted-foreground">
                  Loading guide...
                </div>
              }
            >
              <GuidedAutomationBuilder
                onComplete={handleGuideComplete}
                onBack={() => setIsGuideOpen(false)}
              />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      <ReviewLaunchModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        automation={{
          name: automationName,
          triggerType:
            flowState.nodes.find((n: any) => n.type === "trigger")?.data
              .triggerType || "manual",
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

      {/* Audience Selector Modal */}
      {showAudienceSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b bg-white flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Configure Target Audience
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <AudienceSelector
                selectedPersonas={selectedPersonas}
                selectedSegments={selectedSegments}
                onPersonasChange={setSelectedPersonas}
                onSegmentsChange={setSelectedSegments}
                maxPersonas={3}
                maxSegments={5}
                onClose={() => setShowAudienceSelector(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
