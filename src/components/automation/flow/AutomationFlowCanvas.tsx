import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import EmailNode from './nodes/EmailNode';
import SMSNode from './nodes/SMSNode';
import DelayNode from './nodes/DelayNode';
import SplitNode from './nodes/SplitNode';
import { FloatingToolbar } from './FloatingToolbar';
import { FlowValidation, FlowStatusBadge } from './FlowValidation';
import { ReviewLaunchModal } from './ReviewLaunchModal';
import { NodeEditorDialog } from './NodeEditorDialog';
import { useAutomationFlow } from '../hooks/useAutomationFlow';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { useSegmentSelector } from '@/hooks/useSegmentSelector';
import { Play, Save, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  sms: SMSNode,
  delay: DelayNode,
  split: SplitNode,
};

interface AutomationFlowCanvasProps {
  automationId?: string;
  initialFlowState?: {
    nodes: Node[];
    edges: Edge[];
  };
  onSave?: (flowState: { nodes: Node[]; edges: Edge[] }) => void;
  onLaunch?: (automationData: any) => void;
  onSaveDraft?: () => void;
  onReviewLaunch?: () => void;
  automationName?: string;
  triggerType?: string;
  className?: string;
  selectedPersonas?: any[];
  selectedSegments?: any[];
  onPersonasChange?: (personas: any[]) => void;
  onSegmentsChange?: (segments: any[]) => void;
}

export const AutomationFlowCanvas: React.FC<AutomationFlowCanvasProps> = ({
  automationId,
  initialFlowState,
  onSave,
  onLaunch,
  onSaveDraft,
  onReviewLaunch,
  automationName = '',
  triggerType = '',
  className,
  selectedPersonas = [],
  selectedSegments = [],
  onPersonasChange,
  onSegmentsChange,
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

  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLaunchLoading, setIsLaunchLoading] = useState(false);
  const [editingNode, setEditingNode] = useState<{id: string; type: string; data: any} | null>(null);
  
  const { toast } = useToast();

  // Stable callback for editing nodes
  const handleEditNode = useCallback((id: string, type: string, data: any) => {
    setEditingNode({ id, type, data });
  }, []);

  // Stable callback for deleting nodes
  const handleDeleteNode = useCallback((id: string) => {
    deleteNode(id);
  }, [deleteNode]);

  // Memoized nodeTypes with stable callbacks
  const memoizedNodeTypes = useMemo(() => ({
    trigger: (props: any) => <TriggerNode {...props} onEdit={handleEditNode} onDelete={handleDeleteNode} />,
    email: (props: any) => <EmailNode {...props} onEdit={handleEditNode} onDelete={handleDeleteNode} />,
    sms: (props: any) => <SMSNode {...props} onEdit={handleEditNode} onDelete={handleDeleteNode} />,
    delay: (props: any) => <DelayNode {...props} onEdit={handleEditNode} onDelete={handleDeleteNode} />,
    split: (props: any) => <SplitNode {...props} onEdit={handleEditNode} onDelete={handleDeleteNode} />,
  }), [handleEditNode, handleDeleteNode]);

  // Calculate total audience
  const totalAudienceContacts = selectedSegments.reduce((total, segment) => 
    total + (segment.customer_count || 0), 0
  );

  // Handle node selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Handle connection validation
  const isValidConnection = useCallback((connection: Connection) => {
    // Don't allow connections to trigger nodes
    if (connection.target && nodes.find(n => n.id === connection.target)?.type === 'trigger') {
      return false;
    }
    
    // Don't allow multiple inputs to non-split nodes
    const targetNode = nodes.find(n => n.id === connection.target);
    if (targetNode && targetNode.type !== 'split') {
      const existingConnections = edges.filter(e => e.target === connection.target);
      if (existingConnections.length > 0) {
        return false;
      }
    }

    return true;
  }, [nodes, edges]);

  // Auto-save when flow changes
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      autoSave();
      onSave?.({ nodes, edges });
    }
  }, [nodes, edges, autoSave, onSave]);

  const handleAddNode = useCallback(
    (nodeType: string, position?: { x: number; y: number }) => {
      const defaultPosition = position || { 
        x: Math.random() * 300 + 100, 
        y: Math.random() * 300 + 100 
      };
      
      addNode(nodeType, defaultPosition);
    },
    [addNode]
  );

  const handleReviewAndLaunch = useCallback(() => {
    if (onReviewLaunch) {
      onReviewLaunch();
    } else {
      setShowReviewModal(true);
    }
  }, [onReviewLaunch]);

  const handleLaunch = useCallback(async () => {
    if (!onLaunch) return;
    
    setIsLaunchLoading(true);
    try {
      const automationData = {
        name: automationName,
        triggerType,
        flowSteps: nodes.filter(n => n.type !== 'trigger'),
        selectedAudience: {
          personas: selectedPersonas,
          segments: selectedSegments,
          totalContacts: totalAudienceContacts
        },
        flowState: { nodes, edges }
      };
      
      await onLaunch(automationData);
      setShowReviewModal(false);
      
      toast({
        title: "Automation Activated",
        description: `${automationName} is now running and will process new customers automatically.`,
      });
    } catch (error) {
      console.error('Launch error:', error);
      toast({
        title: "Launch Failed",
        description: "There was an error activating your automation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLaunchLoading(false);
    }
  }, [onLaunch, automationName, triggerType, nodes, edges, selectedPersonas, selectedSegments, totalAudienceContacts, toast]);

  const handleTestSend = useCallback(() => {
    toast({
      title: "Test Send",
      description: "Test functionality will be implemented soon.",
    });
  }, [toast]);

  const handleSaveDraft = useCallback(() => {
    if (onSaveDraft) {
      onSaveDraft();
    } else {
      autoSave();
      toast({
        title: "Draft Saved",
        description: "Your automation has been saved as a draft.",
      });
    }
  }, [onSaveDraft, autoSave, toast]);

  // Check if automation is ready to launch
  const selectedAudience = {
    personas: selectedPersonas,
    segments: selectedSegments,
    totalContacts: totalAudienceContacts
  };

  const hasValidFlow = nodes.some(n => n.type === 'trigger') && 
                     nodes.some(n => n.type === 'email' || n.type === 'sms');
  const hasAudience = selectedPersonas.length > 0 || selectedSegments.length > 0;
  const isReadyToLaunch = hasValidFlow && hasAudience;

  return (
    <div className={`relative w-full h-full ${className}`}>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        isValidConnection={isValidConnection}
        nodeTypes={memoizedNodeTypes}
        fitView
        fitViewOptions={{
          padding: 50,
          minZoom: 0.5,
          maxZoom: 1.2,
          includeHiddenNodes: false
        }}
        attributionPosition="bottom-left"
        className="bg-background"
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap 
          nodeStrokeColor="#374151"
          nodeColor="#f3f4f6"
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="top-right"
        />
      </ReactFlow>

      {/* Flow Status and Actions Below Canvas */}
      <div className="mt-4 flex flex-col items-center gap-3">
        <FlowStatusBadge 
          nodes={nodes} 
          edges={edges} 
          selectedAudience={selectedAudience} 
        />
        
        {hasValidFlow && (
          <div className="flex items-center gap-3">
            {hasAudience && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{totalAudienceContacts} contacts</span>
              </div>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={handleReviewAndLaunch}
                      disabled={!isReadyToLaunch}
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Review & Launch
                    </Button>
                  </div>
                </TooltipTrigger>
                {!isReadyToLaunch && (
                  <TooltipContent>
                    <p>
                      {!nodes.some(n => n.type === 'trigger') && "Add a trigger to continue"}
                      {nodes.some(n => n.type === 'trigger') && !nodes.some(n => n.type === 'email' || n.type === 'sms') && "Add at least one action (email or SMS)"}
                      {hasValidFlow && !hasAudience && "Select an audience to continue"}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      <FloatingToolbar
        onAddNode={handleAddNode}
        selectedNodeId={selectedNode}
        onToggleAISuggestions={() => setShowAISuggestions(!showAISuggestions)}
        showAISuggestions={showAISuggestions}
      />

      {/* AI Suggestions Panel */}
      {showAISuggestions && selectedNode && (
        <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-lg border p-4 z-50">
          <h3 className="font-semibold mb-2">AI Suggestions</h3>
          <p className="text-sm text-muted-foreground">
            Intelligent suggestions will appear here based on your selected node.
          </p>
        </div>
      )}

      {/* Review & Launch Modal */}
      <ReviewLaunchModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        automation={{
          name: automationName,
          triggerType,
          flowSteps: nodes.filter(n => n.type !== 'trigger'),
          selectedAudience
        }}
        onLaunch={handleLaunch}
        onTestSend={handleTestSend}
        isLoading={isLaunchLoading}
      />


      {/* Node Editor Dialog */}
      <NodeEditorDialog
        open={!!editingNode}
        onOpenChange={(open) => !open && setEditingNode(null)}
        nodeType={editingNode?.type || null}
        nodeData={editingNode?.data || null}
        onSave={(data) => {
          if (editingNode) {
            updateNode(editingNode.id, data);
            setEditingNode(null);
          }
        }}
      />
    </div>
  );
};