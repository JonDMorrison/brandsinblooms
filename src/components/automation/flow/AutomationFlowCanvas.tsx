import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Connection,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  Grid3x3,
  Keyboard,
  Map,
  Maximize2,
  Minus,
  Plus,
  Users,
  Workflow,
} from "lucide-react";
import TriggerNode from "./nodes/TriggerNode";
import EmailNode from "./nodes/EmailNode";
import SMSNode from "./nodes/SMSNode";
import DelayNode from "./nodes/DelayNode";
import SplitNode from "./nodes/SplitNode";
import { validateFlow } from "./flowValidationUtils";
import { ReviewLaunchModal } from "./ReviewLaunchModal";
import { NodePalette } from "./NodePalette";
import { AutomationBuilderInspector } from "./AutomationBuilderInspector";
import { useAutomationFlow } from "../hooks/useAutomationFlow";
import type {
  AutomationFlowState,
  AutomationLaunchPayload,
  EmailNodeData,
  TriggerNodeData,
} from "./automationBuilderTypes";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogActions } from "@/components/joy/JoyDialog";
import { AudienceSelector } from "@/components/crm/AudienceSelector";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type {
  TargetingPersona,
  TargetingSegment,
} from "@/hooks/usePersonaSegmentIntegration";
import { computeAudienceRecipientCount } from "@/lib/computeAudienceRecipientCount";
import { compileFlow } from "@/lib/automation/compiler";
import { normalizeTriggerId } from "@/lib/automation/normalize";
import {
  getTriggerById,
  triggerRequiresAudience,
} from "@/lib/automation/triggerCatalog";

interface AutomationFlowCanvasProps {
  automationId?: string;
  initialFlowState?: AutomationFlowState;
  onSave?: (flowState: AutomationFlowState) => void;
  onLaunch?: (automationData: AutomationLaunchPayload) => void | Promise<void>;
  onSaveDraft?: () => void;
  automationName?: string;
  triggerType?: string;
  className?: string;
  selectedPersonas?: TargetingPersona[];
  selectedSegments?: TargetingSegment[];
  onPersonasChange?: (personas: TargetingPersona[]) => void;
  onSegmentsChange?: (segments: TargetingSegment[]) => void;
  reviewRequestKey?: number;
  tenantId?: string | null;
}

type TestEmailResponse = {
  usedFrom?: string;
};

export const AutomationFlowCanvas: React.FC<AutomationFlowCanvasProps> = ({
  automationId,
  initialFlowState,
  onSave,
  onLaunch,
  automationName = "",
  triggerType = "",
  className,
  selectedPersonas = [],
  selectedSegments = [],
  onPersonasChange,
  onSegmentsChange,
  reviewRequestKey,
  tenantId,
}) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNode,
    deleteNode,
    selectedNode,
    setSelectedNode,
    autoSave,
  } = useAutomationFlow(automationId, initialFlowState);
  const { toast } = useToast();
  const { user } = useAuth();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLaunchLoading, setIsLaunchLoading] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);
  const [showAudienceSelector, setShowAudienceSelector] = useState(false);
  const [showMinimap, setShowMinimap] = useState(() => {
    const saved = localStorage.getItem("automation.showMinimap");
    return saved ? JSON.parse(saved) : true;
  });
  const [showGrid, setShowGrid] = useState(() => {
    const saved = localStorage.getItem("automation.showGrid");
    return saved ? JSON.parse(saved) : true;
  });
  const [audienceContactCount, setAudienceContactCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    localStorage.setItem("automation.showMinimap", JSON.stringify(showMinimap));
  }, [showMinimap]);

  useEffect(() => {
    localStorage.setItem("automation.showGrid", JSON.stringify(showGrid));
  }, [showGrid]);

  useEffect(() => {
    if (reviewRequestKey) {
      setShowReviewModal(true);
    }
  }, [reviewRequestKey]);

  useEffect(() => {
    let isActive = true;

    void computeAudienceRecipientCount({
      tenantId,
      segmentIds: selectedSegments.map((segment) => String(segment.id)),
      personaIds: selectedPersonas.map((persona) => String(persona.id)),
    })
      .then((count) => {
        if (isActive) {
          setAudienceContactCount(count);
        }
      })
      .catch((error) => {
        console.error("Failed to compute automation audience reach:", error);
        if (isActive) {
          setAudienceContactCount(0);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedPersonas, selectedSegments, tenantId]);

  useEffect(() => {
    if (selectedNode && !nodes.some((node) => node.id === selectedNode)) {
      setSelectedNode(null);
    }
  }, [nodes, selectedNode, setSelectedNode]);

  const selectedAudience = useMemo(
    () => ({
      personas: selectedPersonas,
      segments: selectedSegments,
      totalContacts: audienceContactCount,
    }),
    [audienceContactCount, selectedPersonas, selectedSegments],
  );

  const triggerNode = nodes.find((node) => node.type === "trigger") ?? null;
  const activeNode = nodes.find((node) => node.id === selectedNode) ?? null;
  const triggerNodeData = (triggerNode?.data ?? {}) as Partial<TriggerNodeData>;
  const currentTriggerType = triggerNodeData.triggerType || "";
  const audienceRequired =
    !!currentTriggerType && triggerRequiresAudience(currentTriggerType);
  const validation = validateFlow(
    nodes,
    edges,
    selectedSegments,
    selectedPersonas,
  );
  const hasValidationErrors = validation.errors.length > 0;
  const compilation = useMemo(() => {
    try {
      return compileFlow({ nodes, edges });
    } catch (error) {
      console.error("Failed to compile automation flow for review:", error);
      return null;
    }
  }, [edges, nodes]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoSave();
      onSave?.({ nodes, edges });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [autoSave, edges, nodes, onSave]);

  const handleInspectNode = useCallback(
    (nodeId: string) => {
      setSelectedNode(nodeId);
    },
    [setSelectedNode],
  );

  const handleRequestDeleteNode = useCallback((nodeId: string) => {
    setPendingDeleteNodeId(nodeId);
  }, []);

  const memoizedNodeTypes = useMemo(
    () => ({
      trigger: (props: React.ComponentProps<typeof TriggerNode>) => (
        <TriggerNode
          {...props}
          onEdit={handleInspectNode}
          onDelete={handleRequestDeleteNode}
        />
      ),
      email: (props: React.ComponentProps<typeof EmailNode>) => (
        <EmailNode
          {...props}
          onEdit={handleInspectNode}
          onDelete={handleRequestDeleteNode}
        />
      ),
      sms: (props: React.ComponentProps<typeof SMSNode>) => (
        <SMSNode
          {...props}
          onEdit={handleInspectNode}
          onDelete={handleRequestDeleteNode}
        />
      ),
      delay: (props: React.ComponentProps<typeof DelayNode>) => (
        <DelayNode
          {...props}
          onEdit={handleInspectNode}
          onDelete={handleRequestDeleteNode}
        />
      ),
      split: (props: React.ComponentProps<typeof SplitNode>) => (
        <SplitNode
          {...props}
          onEdit={handleInspectNode}
          onDelete={handleRequestDeleteNode}
        />
      ),
    }),
    [handleInspectNode, handleRequestDeleteNode],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (
        connection.target &&
        nodes.find((node) => node.id === connection.target)?.type === "trigger"
      ) {
        return false;
      }

      const targetNode = nodes.find((node) => node.id === connection.target);
      if (targetNode && targetNode.type !== "split") {
        const existingConnections = edges.filter(
          (edge) => edge.target === connection.target,
        );
        if (existingConnections.length > 0) {
          return false;
        }
      }

      return true;
    },
    [edges, nodes],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  const handleAddNode = useCallback(
    (
      nodeType: string,
      paletteTriggerType?: string,
      position?: { x: number; y: number },
    ) => {
      const defaultPosition =
        position ||
        (reactFlowInstance
          ? reactFlowInstance.screenToFlowPosition({ x: 560, y: 280 })
          : { x: 280, y: 180 });

      const dataOverrides =
        nodeType === "trigger" && paletteTriggerType
          ? {
              triggerType: paletteTriggerType,
              label:
                getTriggerById(paletteTriggerType)
                  ?.label.replace(/^[^\p{L}\p{N}]+/u, "")
                  .trim() || "Trigger",
              description: getTriggerById(paletteTriggerType)?.description,
            }
          : undefined;

      const createdNodeId = addNode(nodeType, defaultPosition, dataOverrides);
      if (createdNodeId) {
        setSelectedNode(createdNodeId);
      }
    },
    [addNode, reactFlowInstance, setSelectedNode],
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/reactflow-type");
      const droppedTriggerType = event.dataTransfer.getData(
        "application/reactflow-trigger",
      );

      if (!nodeType || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      handleAddNode(nodeType, droppedTriggerType || undefined, position);
    },
    [handleAddNode, reactFlowInstance],
  );

  const handleLaunch = useCallback(async () => {
    if (!onLaunch || hasValidationErrors) {
      return;
    }

    setIsLaunchLoading(true);
    try {
      const nextCompilation = compilation ?? compileFlow({ nodes, edges });
      const automationData = {
        name: automationName,
        triggerType: normalizeTriggerId(
          String(
            triggerNode?.data?.triggerType || triggerType || "loyalty_join",
          ),
        ),
        flowSteps: nodes.filter((node) => node.type !== "trigger"),
        workflowSteps: nextCompilation.steps,
        selectedAudience,
        flowState: { nodes, edges },
        compilation: nextCompilation,
      };

      await onLaunch(automationData);
      setShowReviewModal(false);
      toast({
        title: "Automation Activated",
        description: `${automationName || "Automation"} is now running.`,
      });
    } catch (error) {
      console.error("Launch error:", error);
      toast({
        title: "Launch Failed",
        description:
          "There was an error activating your automation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLaunchLoading(false);
    }
  }, [
    automationName,
    compilation,
    edges,
    hasValidationErrors,
    nodes,
    onLaunch,
    selectedAudience,
    toast,
    triggerNode?.data?.triggerType,
    triggerType,
  ]);

  const handleTestSend = useCallback(
    async (recipientEmail?: string) => {
      if (isTestSending) {
        return;
      }

      try {
        setIsTestSending(true);
        if (!user?.email) {
          toast({
            title: "Authentication Required",
            description: "Please log in to send test emails.",
            variant: "destructive",
          });
          return;
        }

        const emailNodes = nodes.filter((node) => {
          if (node.type !== "email") return false;
          const emailData = (node.data ?? {}) as Partial<EmailNodeData>;
          return (
            !!emailData.subject &&
            !!(emailData.body || emailData.content || emailData.message)
          );
        });

        if (emailNodes.length === 0) {
          toast({
            title: "No Email Content",
            description:
              "Add at least one email step with content to send a test.",
            variant: "destructive",
          });
          return;
        }

        const firstEmailNode = emailNodes[0];
        const firstEmailData = (firstEmailNode.data ??
          {}) as Partial<EmailNodeData>;
        const targetEmail = recipientEmail?.trim() || user.email;

        const { data, error } =
          await supabase.functions.invoke<TestEmailResponse>(
            "send-test-email",
            {
              body: {
                email: targetEmail,
                subject: firstEmailData.subject,
                content:
                  firstEmailData.body ||
                  firstEmailData.content ||
                  firstEmailData.message,
                testName: user.user_metadata?.full_name || "Test User",
                campaignId: `automation-${automationName
                  ?.replace(/\s+/g, "-")
                  .toLowerCase()}`,
              },
            },
          );

        if (error) {
          throw new Error(getErrorMessage(error));
        }

        toast({
          title: "Test Email Sent",
          description: `Sent to ${targetEmail}${
            data?.usedFrom ? ` from ${data.usedFrom}` : ""
          }.`,
        });
      } catch (error) {
        console.error("Test send error:", error);
        toast({
          title: "Test Send Failed",
          description:
            error instanceof Error
              ? error.message
              : "There was an error sending the test email. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsTestSending(false);
      }
    },
    [automationName, isTestSending, nodes, toast, user],
  );

  const handleDeleteConfirmed = useCallback(() => {
    if (!pendingDeleteNodeId) {
      return;
    }

    deleteNode(pendingDeleteNodeId);
    if (selectedNode === pendingDeleteNodeId) {
      setSelectedNode(null);
    }
    setPendingDeleteNodeId(null);
  }, [deleteNode, pendingDeleteNodeId, selectedNode, setSelectedNode]);

  const builderStatusTone = hasValidationErrors
    ? "danger"
    : validation.warnings.length > 0
      ? "warning"
      : "success";
  const builderStatusMessage =
    validation.errors[0] ||
    validation.warnings[0] ||
    "Canvas is structurally ready";

  return (
    <Sheet
      variant="outlined"
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        flex: 1,
        overflow: "hidden",
        borderRadius: "xl",
        backgroundColor: "background.surface",
      }}
    >
      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        <NodePalette onAddNode={handleAddNode} />

        <Box
          sx={{
            position: "relative",
            flex: 1,
            minWidth: 400,
            overflow: "hidden",
            backgroundColor: "background.surface",
            backgroundImage: showGrid
              ? "radial-gradient(circle, var(--joy-palette-neutral-200) 1px, transparent 1px)"
              : "none",
            backgroundSize: "20px 20px",
            "& .react-flow__pane": {
              backgroundColor: "transparent",
            },
            "& .react-flow__node": {
              transition: "filter 0.15s ease",
            },
            "& .react-flow__node:hover": {
              filter: "brightness(1.015)",
            },
            "& .react-flow__edge-path": {
              transition: "stroke 0.2s ease, stroke-dasharray 0.2s ease",
            },
            "& .automation-flow-edge .react-flow__edge-path": {
              stroke: "var(--joy-palette-neutral-300)",
              strokeWidth: 2,
            },
            "& .react-flow__edge:hover .react-flow__edge-path": {
              strokeDasharray: "6 4",
              animation: "automationEdgeDash 0.8s linear infinite",
            },
            "& .automation-edge-flash .react-flow__edge-path": {
              stroke: "var(--joy-palette-primary-400)",
              animation: "automationEdgeFlash 0.85s ease",
            },
            "@keyframes automationEdgeDash": {
              from: {
                strokeDashoffset: 0,
              },
              to: {
                strokeDashoffset: -24,
              },
            },
            "@keyframes automationEdgeFlash": {
              "0%": {
                stroke: "var(--joy-palette-primary-400)",
                strokeDasharray: "6 4",
              },
              "100%": {
                stroke: "var(--joy-palette-neutral-300)",
                strokeDasharray: "0 0",
              },
            },
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedNode(null)}
            onDrop={handleCanvasDrop}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onInit={(instance) => {
              setReactFlowInstance(instance);
              setZoomLevel(instance.getZoom());
            }}
            onViewportChange={(viewport) => setZoomLevel(viewport.zoom)}
            isValidConnection={isValidConnection}
            nodeTypes={memoizedNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.24, minZoom: 0.55, maxZoom: 1.4 }}
            minZoom={0.35}
            maxZoom={1.65}
            defaultEdgeOptions={{
              type: "smoothstep",
              className: "automation-flow-edge",
              style: {
                stroke: "var(--joy-palette-neutral-300)",
                strokeWidth: 2,
              },
            }}
            connectionLineType="smoothstep"
            connectionLineStyle={{
              stroke: "var(--joy-palette-primary-400)",
              strokeWidth: 2,
              strokeDasharray: "5 5",
            }}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
            className="automation-flow-surface"
          >
            {showMinimap ? (
              <MiniMap
                position="top-right"
                nodeStrokeColor="var(--joy-palette-neutral-300)"
                nodeColor="var(--joy-palette-background-surface)"
                maskColor="rgba(var(--joy-palette-neutral-mainChannel) / 0.08)"
                nodeBorderRadius={12}
                style={{
                  width: 180,
                  height: 110,
                  borderRadius: 12,
                  top: 16,
                  right: 16,
                }}
              />
            ) : null}
          </ReactFlow>

          {nodes.length === 0 ? (
            <Stack
              spacing={2}
              alignItems="center"
              justifyContent="center"
              sx={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  backgroundColor: "neutral.50",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "neutral.200",
                }}
              >
                <Workflow size={64} />
              </Box>
              <Stack spacing={0.75} alignItems="center">
                <Typography level="title-md">
                  Start building your automation
                </Typography>
                <Typography
                  level="body-sm"
                  sx={{ color: "neutral.500", maxWidth: 320 }}
                >
                  Drag a trigger from the left panel to begin, or drop any node
                  onto the canvas.
                </Typography>
              </Stack>
            </Stack>
          ) : null}

          <Sheet
            variant="outlined"
            sx={{
              position: "absolute",
              left: "50%",
              bottom: 16,
              transform: "translateX(-50%)",
              zIndex: 6,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              p: 0.5,
              borderRadius: "12px",
              boxShadow: "md",
              backgroundColor: "background.surface",
            }}
          >
            <Tooltip title="Zoom out">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() =>
                  void reactFlowInstance?.zoomOut({ duration: 140 })
                }
              >
                <Minus size={16} />
              </IconButton>
            </Tooltip>

            <Typography
              level="body-xs"
              sx={{ minWidth: 44, textAlign: "center", fontWeight: 600 }}
            >
              {Math.round(zoomLevel * 100)}%
            </Typography>

            <Tooltip title="Zoom in">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() =>
                  void reactFlowInstance?.zoomIn({ duration: 140 })
                }
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" sx={{ mx: 0.25, height: 20 }} />

            <Tooltip title="Fit canvas">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() =>
                  void reactFlowInstance?.fitView({
                    padding: 0.24,
                    duration: 180,
                  })
                }
              >
                <Maximize2 size={16} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Toggle minimap">
              <IconButton
                size="sm"
                variant={showMinimap ? "soft" : "plain"}
                color="neutral"
                onClick={() => setShowMinimap((current) => !current)}
              >
                <Map size={16} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Toggle grid">
              <IconButton
                size="sm"
                variant={showGrid ? "soft" : "plain"}
                color="neutral"
                onClick={() => setShowGrid((current) => !current)}
              >
                <Grid3x3 size={16} />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" sx={{ mx: 0.25, height: 20 }} />

            <Tooltip
              placement="top"
              title={
                <Stack spacing={0.5} sx={{ py: 0.25 }}>
                  <Typography level="body-xs">Ctrl S: Save draft</Typography>
                  <Typography level="body-xs">Ctrl Z: Undo</Typography>
                  <Typography level="body-xs">
                    Delete: Delete selected node
                  </Typography>
                  <Typography level="body-xs">Ctrl + / Ctrl -: Zoom</Typography>
                  <Typography level="body-xs">Ctrl 0: Fit to screen</Typography>
                </Stack>
              }
            >
              <IconButton size="sm" variant="plain" color="neutral">
                <Keyboard size={16} />
              </IconButton>
            </Tooltip>
          </Sheet>
        </Box>

        <AutomationBuilderInspector
          activeNode={activeNode}
          nodes={nodes}
          edges={edges}
          selectedPersonas={selectedPersonas}
          selectedSegments={selectedSegments}
          audienceContactCount={audienceContactCount}
          onUpdateNode={updateNode}
          onDeleteNodeRequest={handleRequestDeleteNode}
          onOpenAudienceSelector={() => setShowAudienceSelector(true)}
        />
      </Stack>

      <Sheet
        component="footer"
        sx={{
          px: 3,
          py: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "background.surface",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor:
                builderStatusTone === "success"
                  ? "success.500"
                  : builderStatusTone === "warning"
                    ? "warning.500"
                    : "danger.500",
            }}
          />
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {builderStatusMessage}
          </Typography>
        </Stack>

        <JoyButton
          variant="plain"
          color="neutral"
          size="sm"
          startDecorator={<Users size={14} />}
          onClick={() => setShowAudienceSelector(true)}
          sx={{
            minHeight: "auto",
            px: 0,
            color: "neutral.500",
            "&:hover": {
              backgroundColor: "transparent",
              color: "neutral.700",
              textDecoration: "underline",
            },
          }}
        >
          {selectedPersonas.length + selectedSegments.length} audience filters
          selected
        </JoyButton>
      </Sheet>

      <JoyDialog
        open={showAudienceSelector}
        onClose={() => setShowAudienceSelector(false)}
        title="Configure target audience"
        description="Choose the personas or segments that this automation should target when an audience is required."
        size="xl"
      >
        <AudienceSelector
          selectedPersonas={selectedPersonas}
          selectedSegments={selectedSegments}
          onPersonasChange={onPersonasChange || (() => {})}
          onSegmentsChange={onSegmentsChange || (() => {})}
          maxPersonas={3}
          maxSegments={5}
          onClose={() => setShowAudienceSelector(false)}
        />
      </JoyDialog>

      <JoyDialog
        open={!!pendingDeleteNodeId}
        onClose={() => setPendingDeleteNodeId(null)}
        title="Delete node?"
        description="This will remove the selected node and any connections attached to it."
        size="sm"
      >
        <JoyDialogActions>
          <JoyButton
            variant="outlined"
            color="neutral"
            onClick={() => setPendingDeleteNodeId(null)}
          >
            Cancel
          </JoyButton>
          <JoyButton color="danger" onClick={handleDeleteConfirmed}>
            Delete node
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <ReviewLaunchModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        automation={{
          name: automationName,
          triggerType: normalizeTriggerId(
            String(
              triggerNode?.data?.triggerType || triggerType || "loyalty_join",
            ),
          ),
          flowSteps: nodes.filter((node) => node.type !== "trigger"),
          selectedAudience,
          compilation,
          validation,
        }}
        onLaunch={handleLaunch}
        onTestSend={handleTestSend}
        isLoading={isLaunchLoading}
        isTestSending={isTestSending}
      />
    </Sheet>
  );
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Failed to send test email";
}
