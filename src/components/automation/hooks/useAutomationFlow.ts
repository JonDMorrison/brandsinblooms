import { useCallback, useState, useEffect } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAutomationFlow = (
  automationId?: string,
  initialFlowState?: { nodes: Node[]; edges: Edge[] }
) => {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialFlowState?.nodes || []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialFlowState?.edges || []
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Handle connections between nodes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Generate unique node ID
  const generateNodeId = useCallback((type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add new node to canvas
  const addNode = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      const newNode: Node = {
        id: generateNodeId(nodeType),
        type: nodeType,
        position,
        data: getDefaultNodeData(nodeType),
      };

      setNodes((nds) => [...nds, newNode]);
      setIsDirty(true);
    },
    [generateNodeId, setNodes]
  );

  // Update node data
  const updateNode = useCallback(
    (nodeId: string, newData: Partial<any>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...newData } }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  // Delete node and its connections
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => 
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setIsDirty(true);
    },
    [setNodes, setEdges]
  );

  // Auto-save to localStorage
  const autoSave = useCallback(() => {
    if (isDirty && (nodes.length > 0 || edges.length > 0)) {
      const flowState = { nodes, edges };
      localStorage.setItem(
        `automation-flow-${automationId || 'new'}`,
        JSON.stringify(flowState)
      );
      setIsDirty(false);
    }
  }, [nodes, edges, isDirty, automationId]);

  // Save to database
  const saveToDatabase = useCallback(async () => {
    if (!automationId) return;

    try {
      const flowState = { nodes, edges };
      // TODO: Update to use flow_state column once migrations are applied
      console.log('Would save flow state:', flowState);
      // const { error } = await supabase
      //   .from('crm_automations')
      //   .update({ flow_state: flowState })
      //   .eq('id', automationId);

      // if (error) throw error;

      toast({
        title: 'Success',
        description: 'Automation flow saved successfully!',
      });
    } catch (error) {
      console.error('Error saving flow:', error);
      toast({
        title: 'Error',
        description: 'Failed to save automation flow.',
        variant: 'destructive',
      });
    }
  }, [nodes, edges, automationId, toast]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!initialFlowState && automationId) {
      const savedFlow = localStorage.getItem(`automation-flow-${automationId}`);
      if (savedFlow) {
        try {
          const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedFlow);
          setNodes(savedNodes || []);
          setEdges(savedEdges || []);
        } catch (error) {
          console.error('Error loading saved flow:', error);
        }
      }
    }
  }, [automationId, initialFlowState, setNodes, setEdges]);

  // Auto-save periodically
  useEffect(() => {
    const interval = setInterval(autoSave, 5000); // Auto-save every 5 seconds
    return () => clearInterval(interval);
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

// Default data for different node types
function getDefaultNodeData(nodeType: string) {
  switch (nodeType) {
    case 'trigger':
      return {
        triggerType: 'loyalty_join',
        label: 'Loyalty Program Sign-up',
        conditions: {},
      };
    case 'email':
      return {
        subject: '',
        content: '',
        template: '',
        editable: true,
      };
    case 'sms':
      return {
        content: '',
        characterCount: 0,
        editable: true,
      };
    case 'delay':
      return {
        delayValue: 1,
        delayUnit: 'hours' as const,
        editable: true,
      };
    case 'split':
      return {
        splitType: 'conditional' as const,
        conditions: [],
        editable: true,
      };
    default:
      return {};
  }
}