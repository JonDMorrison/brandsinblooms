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
import { useAutomationFlow } from '../hooks/useAutomationFlow';

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
  className?: string;
}

export const AutomationFlowCanvas: React.FC<AutomationFlowCanvasProps> = ({
  automationId,
  initialFlowState,
  onSave,
  className,
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
    </div>
  );
};