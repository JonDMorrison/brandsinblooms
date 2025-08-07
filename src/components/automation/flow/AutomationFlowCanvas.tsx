import React, { useCallback, useEffect, useState } from 'react';
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
import { useAutomationFlow } from '../hooks/useAutomationFlow';
import { Button } from '@/components/ui/button';
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
  
  const { toast } = useToast();

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
      {/* Canvas Status Header */}
      <div className="absolute top-4 left-4 z-50 bg-white rounded-lg shadow-lg border p-3">
        <div className="flex items-center gap-3">
          <FlowStatusBadge 
            nodes={nodes} 
            edges={edges} 
            selectedAudience={selectedAudience}
          />
            <AudienceTargetingButton
              selectedPersonas={selectedPersonas}
              selectedSegments={selectedSegments}
              onPersonasChange={onPersonasChange || (() => {})}
              onSegmentsChange={onSegmentsChange || (() => {})}
            />
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
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
    </div>
  );
};