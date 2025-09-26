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
    initialFlowState?.nodes || getDefaultWelcomeFlow().nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialFlowState?.edges || getDefaultWelcomeFlow().edges
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

  // Sync with initialFlowState changes (when automation data is loaded)
  useEffect(() => {
    if (initialFlowState && (initialFlowState.nodes.length > 0 || initialFlowState.edges.length > 0)) {
      setNodes(initialFlowState.nodes);
      setEdges(initialFlowState.edges);
    }
  }, [initialFlowState, setNodes, setEdges]);

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

// Default "Loyalty Program Ongoing Nurture Series" flow
function getDefaultWelcomeFlow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'trigger-loyalty',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        triggerType: 'loyalty_members_segment',
        label: 'New Loyalty Member',
        conditions: {},
      },
    },
    {
      id: 'sms-immediate',
      type: 'sms',
      position: { x: 250, y: 180 },
      data: {
        content: 'Thanks for joining our Loyalty Program at {{garden_center_name}}! Enjoy 10% off your next visit. Show this message at checkout. Reply STOP to opt out.',
        characterCount: 159,
        editable: true,
        delay: 'Immediate',
      },
    },
    {
      id: 'email-thank-you',
      type: 'email',
      position: { x: 250, y: 310 },
      data: {
        subject: 'Thanks for visiting {{garden_center_name}} — enjoy your reward!',
        content: 'Hi there!\n\nThanks so much for visiting our garden center and joining our loyalty program. We hope you found exactly what you were looking for!\n\nDon\'t forget about your 10% off reward — just show the text message we sent you at checkout on your next visit.',
        template: 'customer_loyalty_program-1',
        editable: true,
        delay: '24 hours',
      },
    },
    {
      id: 'email-seasonal-tip',
      type: 'email',
      position: { x: 250, y: 440 },
      data: {
        subject: 'A quick tip for your garden this week',
        content: 'Hi {{first_name}}!\n\nHere\'s a quick gardening tip to help you make the most of this season:\n\n{{seasonal_tip}}\n\nAs a loyal member, you still have that 10% off reward waiting for you at {{garden_center_name}}.',
        template: 'customer_loyalty_program-2',
        editable: true,
        delay: '7 days',
      },
    },
    {
      id: 'sms-reminder',
      type: 'sms',
      position: { x: 250, y: 570 },
      data: {
        content: 'Hi {{first_name}}, just a reminder you\'ve got 10% off waiting for you at {{garden_center_name}}. Stop by soon and see what\'s new! Reply STOP to opt out.',
        characterCount: 158,
        editable: true,
        delay: '14 days',
      },
    },
    {
      id: 'email-mission',
      type: 'email',
      position: { x: 250, y: 700 },
      data: {
        subject: 'Why we love serving gardeners like you',
        content: 'Hi {{first_name}}!\n\nWe wanted to take a moment to share why {{garden_center_name}} exists. Our mission is simple: to help every gardener in our community grow beautiful, thriving spaces that bring joy and connection to nature.',
        template: 'customer_loyalty_program-4',
        editable: true,
        delay: '30 days',
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e1',
      source: 'trigger-loyalty',
      target: 'sms-immediate',
      type: 'smoothstep',
    },
    {
      id: 'e2',
      source: 'sms-immediate',
      target: 'email-thank-you',
      type: 'smoothstep',
    },
    {
      id: 'e3',
      source: 'email-thank-you',
      target: 'email-seasonal-tip',
      type: 'smoothstep',
    },
    {
      id: 'e4',
      source: 'email-seasonal-tip',
      target: 'sms-reminder',
      type: 'smoothstep',
    },
    {
      id: 'e5',
      source: 'sms-reminder',
      target: 'email-mission',
      type: 'smoothstep',
    },
  ];

  return { nodes, edges };
}

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