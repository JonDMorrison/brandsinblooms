import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FlaskConical,
  PauseCircle,
  Play,
  Save,
  Zap,
} from "lucide-react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AskBloomResourceTrigger } from "@/components/askBloom/AskBloomResourceTrigger";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { AutomationFlowCanvas } from "@/components/automation/flow/AutomationFlowCanvas";
import { InlineEditableText } from "@/components/automation/flow/InlineEditableText";
import { validateFlow } from "@/components/automation/flow/flowValidationUtils";
import type {
  AutomationFlowState,
  PersistedAutomationEdge,
  TriggerNodeData,
} from "@/components/automation/flow/automationBuilderTypes";
import { isAutomationFlowState } from "@/components/automation/flow/automationBuilderTypes";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  type TargetingPersona,
  type TargetingSegment,
  usePersonaSegmentIntegration,
} from "@/hooks/usePersonaSegmentIntegration";
import {
  extractTriggerConditions,
  validateTriggerConditions,
} from "@/lib/automation/extractTriggerConditions";
import { buildGenericFocus } from "@/utils/askBloomContextBuilders";
import { registerResourceAccessor } from "@/utils/askBloomResourceRegistry";

interface AutomationRunSummary {
  executionCount: number;
  lastTriggeredAt: string | null;
}

export const CRMAutomationBuilder = () => {
  const { automationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { loadAutomationTargeting, saveAutomationTargeting } =
    usePersonaSegmentIntegration();
  const [automationName, setAutomationName] = useState("New Automation");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(automationId));
  const [flowState, setFlowState] = useState<AutomationFlowState>({
    nodes: [],
    edges: [],
  });
  const [selectedPersonas, setSelectedPersonas] = useState<TargetingPersona[]>(
    [],
  );
  const [selectedSegments, setSelectedSegments] = useState<TargetingSegment[]>(
    [],
  );
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [reviewRequestKey, setReviewRequestKey] = useState(0);
  const [runSummary, setRunSummary] = useState<AutomationRunSummary>({
    executionCount: 0,
    lastTriggeredAt: null,
  });

  useEffect(() => {
    document.title = `${automationName} - Automation Builder`;
  }, [automationName]);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch tenant_id:", error);
        return;
      }

      setTenantId(data?.tenant_id ?? null);
    };

    void fetchTenant();
  }, [user?.id]);

  const loadAutomation = useCallback(async () => {
    if (!automationId) return;

    setIsLoading(true);
    try {
      const [{ data, error }, runsResult, targeting] = await Promise.all([
        supabase
          .from("crm_automations")
          .select("*")
          .eq("id", automationId)
          .single(),
        supabase
          .from("automation_runs")
          .select("status, started_at, created_at")
          .eq("automation_id", automationId)
          .order("created_at", { ascending: false }),
        loadAutomationTargeting(automationId),
      ]);

      if (error) {
        throw error;
      }

      if (data) {
        setAutomationName(data.name || "Untitled Automation");
        setIsActive(Boolean(data.is_active));
        setLastSavedAt(data.updated_at || data.created_at || null);
        setSelectedPersonas(targeting.personas);
        setSelectedSegments(targeting.segments);

        const rawFlow = data.flow_state as unknown;
        if (isAutomationFlowState(rawFlow)) {
          setFlowState({
            nodes: rawFlow.nodes,
            edges: rawFlow.edges
              .map((edge) => {
                const persistedEdge = edge as PersistedAutomationEdge;
                const source = persistedEdge.source || persistedEdge.from;
                const target = persistedEdge.target || persistedEdge.to;

                if (!source || !target) {
                  return null;
                }

                return {
                  ...persistedEdge,
                  id: persistedEdge.id || `${source}-${target}`,
                  source,
                  target,
                };
              })
              .filter((edge) => edge !== null),
          });
        }
      }

      if (!runsResult.error) {
        const runs = runsResult.data || [];
        setRunSummary({
          executionCount: runs.length,
          lastTriggeredAt: runs[0]?.started_at || runs[0]?.created_at || null,
        });
      }
    } catch (error) {
      console.error("Error loading automation:", error);
      toast({
        title: "Error",
        description: "Failed to load automation.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [automationId, loadAutomationTargeting, toast]);

  useEffect(() => {
    if (!automationId) {
      setIsLoading(false);
      return;
    }

    void loadAutomation();
  }, [automationId, loadAutomation]);

  const mapTriggerType = useCallback((triggerType?: string) => {
    if (!triggerType) return "manual";

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
      "form_submitted",
      "contact.updated",
      "custom_webhook",
      "new_product_drop",
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
  }, []);

  const handlePersist = useCallback(
    async (nextActiveState: boolean) => {
      if (!user?.id) {
        toast({
          title: "Not signed in",
          description: `Please sign in to ${nextActiveState ? "activate" : "save"} this automation.`,
          variant: "destructive",
        });
        return false;
      }

      const triggerNode = flowState.nodes.find(
        (node) => node.type === "trigger",
      );
      const triggerData = (triggerNode?.data ?? {}) as Partial<TriggerNodeData>;
      const triggerSubtype = String(triggerData.triggerType || "manual");
      const triggerConditions = {
        ...extractTriggerConditions(flowState),
        subtype: triggerSubtype,
      };
      const overlapBehavior = String(triggerData.overlapBehavior || "ignore");
      const mappedTriggerType = mapTriggerType(triggerSubtype);
      const workflowSteps = flowState.nodes
        .filter((node) => node.type !== "trigger")
        .map((node) => ({ type: node.type, ...(node.data ?? {}) }));

      if (nextActiveState) {
        const validation = validateTriggerConditions(
          mappedTriggerType,
          triggerConditions,
        );
        const flowValidation = validateFlow(
          flowState.nodes,
          flowState.edges,
          selectedSegments,
          selectedPersonas,
        );
        if (!validation.valid) {
          toast({
            title: "Missing Configuration",
            description:
              validation.message ||
              "Please complete the trigger configuration.",
            variant: "destructive",
          });
          return false;
        }
        if (flowValidation.errors.length > 0) {
          toast({
            title: "Launch blockers remain",
            description: flowValidation.errors[0],
            variant: "destructive",
          });
          return false;
        }
      }

      const payload = {
        name: automationName,
        is_active: nextActiveState,
        trigger_type: mappedTriggerType,
        trigger_conditions: triggerConditions,
        overlap_behavior: overlapBehavior,
        workflow_steps: workflowSteps,
        flow_state: flowState,
        user_id: user.id,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      };

      setIsSaving(true);
      try {
        let savedId = automationId;

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
          savedId = data?.id;
        }

        if (savedId) {
          await saveAutomationTargeting({
            automationId: savedId,
            personas: selectedPersonas,
            segments: selectedSegments,
          });
        }

        if (savedId && !automationId) {
          navigate(`/crm/automations/${savedId}`, { replace: true });
        }

        setIsActive(nextActiveState);
        setLastSavedAt(new Date().toISOString());
        toast({
          title: nextActiveState ? "Activated" : "Saved",
          description: nextActiveState
            ? "Automation has been activated successfully."
            : "Draft saved successfully.",
        });
        return true;
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: nextActiveState
            ? "Failed to activate automation."
            : "Failed to save draft.",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      automationId,
      automationName,
      flowState,
      mapTriggerType,
      navigate,
      selectedPersonas,
      selectedSegments,
      saveAutomationTargeting,
      tenantId,
      toast,
      user?.id,
    ],
  );

  const handlePause = useCallback(async () => {
    if (!automationId) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("crm_automations")
        .update({ is_active: false })
        .eq("id", automationId);

      if (error) throw error;

      setIsActive(false);
      setLastSavedAt(new Date().toISOString());
      toast({
        title: "Paused",
        description: "Automation has been paused.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to pause automation.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [automationId, toast]);

  const flowValidation = useMemo(
    () =>
      validateFlow(
        flowState.nodes,
        flowState.edges,
        selectedSegments,
        selectedPersonas,
      ),
    [flowState.edges, flowState.nodes, selectedPersonas, selectedSegments],
  );

  const workflowStepCount = useMemo(
    () => flowState.nodes.filter((node) => node.type !== "trigger").length,
    [flowState.nodes],
  );

  const statusChip = useMemo(() => {
    if (isActive) {
      return { color: "success" as const, label: "Active" };
    }

    if (automationId && runSummary.executionCount > 0) {
      return { color: "warning" as const, label: "Paused" };
    }

    return { color: "neutral" as const, label: "Draft" };
  }, [automationId, isActive, runSummary.executionCount]);

  const buildAutomationResourceFocus = useCallback(() => {
    if (!automationId) {
      throw new Error("Automation focus is unavailable until the draft is saved.");
    }

    return buildGenericFocus("automation", automationId, automationName, {
      status: statusChip.label,
      isActive,
      workflowStepCount,
      executionCount: runSummary.executionCount,
      lastTriggeredAt: runSummary.lastTriggeredAt,
      lastSavedAt,
      selectedSegments: selectedSegments.map((segment) => segment.name),
      selectedPersonas: selectedPersonas.map((persona) => persona.persona_name),
    });
  }, [
    automationId,
    automationName,
    isActive,
    lastSavedAt,
    runSummary.executionCount,
    runSummary.lastTriggeredAt,
    selectedPersonas,
    selectedSegments,
    statusChip.label,
    workflowStepCount,
  ]);

  useEffect(() => {
    if (!automationId) {
      return;
    }

    return registerResourceAccessor("automation", {
      getResourceFocus: (resourceId) => {
        if (resourceId !== automationId) {
          return null;
        }

        return buildAutomationResourceFocus();
      },
    });
  }, [automationId, buildAutomationResourceFocus]);

  if (isLoading) {
    return (
      <PageContainer
        fullWidth
        sx={{
          flex: 1,
          height: "100%",
          minHeight: 0,
          px: { xs: 2, md: 3 },
          py: 2.5,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack spacing={2} sx={{ height: "100%", minHeight: 0, flex: 1 }}>
          <Skeleton
            variant="rectangular"
            sx={{ height: 132, borderRadius: "xl" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ flex: 1, minHeight: 520, borderRadius: "xl" }}
          />
        </Stack>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      fullWidth
      sx={{
        flex: 1,
        height: "100%",
        minHeight: 0,
        px: { xs: 2, md: 3 },
        py: 2.5,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={2} sx={{ height: "100%", minHeight: 0, flex: 1 }}>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: "xl",
            backgroundColor: "background.surface",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 2.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Link
                component={RouterLink}
                to="/crm/automations"
                underline="none"
                level="body-xs"
                sx={{
                  color: "neutral.600",
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  "&:hover": {
                    textDecoration: "underline",
                  },
                }}
              >
                <ArrowLeft size={14} />
                Back to automations
              </Link>

              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                spacing={2}
                alignItems={{ xs: "stretch", lg: "flex-start" }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "primary.100",
                      color: "primary.600",
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={24} />
                  </Box>

                  <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    <InlineEditableText
                      value={automationName}
                      onCommit={setAutomationName}
                      level="h4"
                      fallbackValue="New Automation"
                      typographySx={{ fontWeight: 700, lineHeight: 1.1 }}
                      inputSx={{ maxWidth: 420 }}
                    />
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.600", maxWidth: 560 }}
                    >
                      Build and launch event-driven customer automations from a
                      premium visual canvas.
                    </Typography>
                  </Stack>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  {automationId ? (
                    <AskBloomResourceTrigger
                      resourceType="automation"
                      resourceId={automationId}
                      resourceLabel={automationName}
                      buildContext={buildAutomationResourceFocus}
                    />
                  ) : null}
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    startDecorator={<Save size={16} />}
                    onClick={() => void handlePersist(false)}
                    loading={isSaving}
                  >
                    Save Draft
                  </JoyButton>
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    startDecorator={<FlaskConical size={16} />}
                    onClick={() => setReviewRequestKey((value) => value + 1)}
                    disabled={flowValidation.errors.length > 0}
                  >
                    Test
                  </JoyButton>
                  {isActive ? (
                    <JoyButton
                      variant="outlined"
                      color="neutral"
                      size="sm"
                      startDecorator={<PauseCircle size={16} />}
                      onClick={() => void handlePause()}
                      loading={isSaving}
                    >
                      Pause
                    </JoyButton>
                  ) : (
                    <JoyButton
                      variant="solid"
                      color="primary"
                      size="sm"
                      startDecorator={<Play size={16} />}
                      onClick={() => setReviewRequestKey((value) => value + 1)}
                      disabled={flowValidation.errors.length > 0}
                    >
                      Activate
                    </JoyButton>
                  )}
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1.5}
              >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={statusChip.color}
                    startDecorator={
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: `${statusChip.color}.500`,
                        }}
                      />
                    }
                  >
                    {statusChip.label}
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral">
                    {workflowStepCount} steps
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral">
                    {runSummary.executionCount} executions
                  </Chip>
                  {lastSavedAt ? (
                    <Chip
                      size="sm"
                      variant="soft"
                      color="neutral"
                      startDecorator={<Clock3 size={12} />}
                    >
                      Saved {formatRelativeTime(lastSavedAt)}
                    </Chip>
                  ) : null}
                </Stack>

                {automationId ? (
                  <Link
                    component={RouterLink}
                    to={`/crm/automations/${automationId}/executions`}
                    underline="none"
                    level="body-xs"
                    sx={{
                      color: "primary.600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      fontWeight: 600,
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    Executions
                    <ArrowRight size={12} />
                  </Link>
                ) : (
                  <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                    Executions →
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Box>
        </Sheet>

        <Box sx={{ flex: 1, height: "100%", minHeight: 0, display: "flex" }}>
          <AutomationFlowCanvas
            automationId={automationId}
            initialFlowState={flowState}
            onSave={setFlowState}
            onLaunch={() => handlePersist(true)}
            automationName={automationName}
            selectedPersonas={selectedPersonas}
            selectedSegments={selectedSegments}
            onPersonasChange={setSelectedPersonas}
            onSegmentsChange={setSelectedSegments}
            reviewRequestKey={reviewRequestKey}
            tenantId={tenantId}
            className="builder-canvas"
          />
        </Box>
      </Stack>
    </PageContainer>
  );
};

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "recently";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
