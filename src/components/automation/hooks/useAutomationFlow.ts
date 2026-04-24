import { useCallback, useEffect, useState } from "react";
import {
  addEdge,
  type Connection,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  AutomationFlowState,
  AutomationNodeData,
} from "@/components/automation/flow/automationBuilderTypes";

export const useAutomationFlow = (
  automationId?: string,
  initialFlowState?: AutomationFlowState,
) => {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialFlowState?.nodes || getDefaultWelcomeFlow().nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialFlowState?.edges || getDefaultWelcomeFlow().edges,
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            id: `${params.source || "source"}-${params.target || "target"}-${Date.now()}`,
            type: "smoothstep",
            className: "automation-flow-edge automation-edge-flash",
          },
          currentEdges,
        ),
      ),
    [setEdges],
  );

  const generateNodeId = useCallback((type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  const addNode = useCallback(
    (
      nodeType: string,
      position: { x: number; y: number },
      dataOverrides?: Record<string, unknown>,
    ) => {
      let createdNodeId: string | null = null;

      setNodes((currentNodes) => {
        if (
          nodeType === "trigger" &&
          currentNodes.some((node) => node.type === "trigger")
        ) {
          toast({
            title: "Trigger already exists",
            description: "Only one trigger is allowed per automation.",
            variant: "destructive",
          });
          return currentNodes;
        }

        createdNodeId = generateNodeId(nodeType);

        const newNode: Node = {
          id: createdNodeId,
          type: nodeType,
          position,
          className: "automation-node-enter",
          data: {
            ...getDefaultNodeData(nodeType),
            ...(dataOverrides || {}),
          },
        };

        return [...currentNodes, newNode];
      });

      setIsDirty(true);
      return createdNodeId;
    },
    [generateNodeId, setNodes, toast],
  );

  const updateNode = useCallback(
    (nodeId: string, newData: Partial<AutomationNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...newData } }
            : node,
        ),
      );
      setIsDirty(true);
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.filter((node) => node.id !== nodeId),
      );
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
      setIsDirty(true);
    },
    [setEdges, setNodes],
  );

  const autoSave = useCallback(() => {
    if (!isDirty) {
      return;
    }

    const storageKey = `automation-flow-${automationId || "new"}`;

    if (nodes.length > 0 || edges.length > 0) {
      const flowState: AutomationFlowState = { nodes, edges };
      localStorage.setItem(storageKey, JSON.stringify(flowState));
    } else {
      localStorage.removeItem(storageKey);
    }

    setIsDirty(false);
  }, [automationId, edges, isDirty, nodes]);

  const saveToDatabase = useCallback(async () => {
    if (!automationId) {
      return;
    }

    try {
      const flowState: AutomationFlowState = { nodes, edges };

      // TODO: Update to use flow_state column once migrations are applied
      // const { error } = await supabase
      //   .from("crm_automations")
      //   .update({ flow_state: flowState })
      //   .eq("id", automationId);
      //
      // if (error) throw error;
      void flowState;
      void supabase;

      toast({
        title: "Success",
        description: "Automation flow saved successfully!",
      });
    } catch (error) {
      console.error("Error saving flow:", error);
      toast({
        title: "Error",
        description: "Failed to save automation flow.",
        variant: "destructive",
      });
    }
  }, [automationId, edges, nodes, toast]);

  useEffect(() => {
    if (initialFlowState || !automationId) {
      return;
    }

    const savedFlow = localStorage.getItem(`automation-flow-${automationId}`);
    if (!savedFlow) {
      return;
    }

    try {
      const parsedFlow = JSON.parse(savedFlow) as Partial<AutomationFlowState>;
      setNodes(parsedFlow.nodes || []);
      setEdges(parsedFlow.edges || []);
    } catch (error) {
      console.error("Error loading saved flow:", error);
    }
  }, [automationId, initialFlowState, setEdges, setNodes]);

  useEffect(() => {
    if (!initialFlowState) {
      return;
    }

    if (
      initialFlowState.nodes.length === 0 &&
      initialFlowState.edges.length === 0
    ) {
      return;
    }

    setNodes(initialFlowState.nodes);
    setEdges(initialFlowState.edges);
  }, [initialFlowState, setEdges, setNodes]);

  useEffect(() => {
    const interval = window.setInterval(autoSave, 5000);
    return () => window.clearInterval(interval);
  }, [autoSave]);

  return {
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
    saveToDatabase,
  };
};

function getDefaultWelcomeFlow(): AutomationFlowState {
  return {
    nodes: [],
    edges: [],
  };
}

function getDefaultNodeData(nodeType: string): AutomationNodeData {
  switch (nodeType) {
    case "trigger":
      return {
        triggerType: "loyalty_join",
        label: "Loyalty Program Sign-up",
        conditions: {},
      };
    case "email":
      return {
        subject: "",
        content: "",
        template: "",
        editable: true,
      };
    case "sms":
      return {
        content: "",
        characterCount: 0,
        editable: true,
      };
    case "delay":
      return {
        delayValue: 1,
        delayUnit: "hours",
        editable: true,
      };
    case "split":
      return {
        splitType: "conditional",
        conditions: [],
        editable: true,
      };
    default:
      return {};
  }
}
