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
import { AIAssistant } from './AIAssistant';
import { ReviewLaunchModal } from './ReviewLaunchModal';
import { NodeEditorDialog } from './NodeEditorDialog';
import { useAutomationFlow } from '../hooks/useAutomationFlow';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { AudienceSelector } from '@/components/crm/AudienceSelector';
import { useSegmentSelector } from '@/hooks/useSegmentSelector';
import { Play, Save, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { compileFlow } from '@/lib/automation/compiler';
import { normalizeTriggerId } from '@/lib/automation/normalize';

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
  const [showAudienceSelector, setShowAudienceSelector] = useState(false);
  
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

  // Auto-save when flow changes (debounced to prevent excessive saves)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (nodes.length > 0 || edges.length > 0) {
        autoSave();
        onSave?.({ nodes, edges });
      }
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timeoutId);
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
      // Compile flow state to workflow steps
      const compilation = compileFlow({ nodes, edges });
      const triggerNode = nodes.find(n => n.type === 'trigger');
      const normalizedTrigger = triggerNode ? normalizeTriggerId(String(triggerNode.data?.triggerType) || 'loyalty_join') : 'loyalty_join';
      
      const automationData = {
        name: automationName,
        triggerType: normalizedTrigger,
        flowSteps: nodes.filter(n => n.type !== 'trigger'),
        workflowSteps: compilation.steps,
        selectedAudience: {
          personas: selectedPersonas,
          segments: selectedSegments,
          totalContacts: totalAudienceContacts
        },
        flowState: { nodes, edges },
        compilation
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
  }, [onLaunch, automationName, nodes, edges, selectedPersonas, selectedSegments, totalAudienceContacts, toast]);

  const { user } = useAuth();
  const [isTestSending, setIsTestSending] = useState(false);

  const handleTestSend = useCallback(async (recipientEmail?: string) => {
    console.log('🧪 Send Test button clicked!', { isTestSending, user: user?.email, recipientEmail });
    
    if (isTestSending) {
      console.log('❌ Already sending test, ignoring click');
      return;
    }
    
    try {
      console.log('🚀 Starting test send process...');
      setIsTestSending(true);
      
      // Check if user is authenticated
      console.log('🔐 Checking authentication...', user?.email);
      if (!user?.email) {
        console.log('❌ No user email found');
        toast({
          title: "Authentication Required",
          description: "Please log in to send test emails.",
          variant: "destructive",
        });
        return;
      }

      // Find email nodes in the flow
      console.log('📧 Looking for email nodes...', nodes.length, 'total nodes');
      nodes.forEach((node, index) => {
        console.log(`📧 Node ${index}:`, {
          id: node.id,
          type: node.type,
          dataKeys: Object.keys(node.data || {}),
          hasSubject: !!node.data?.subject,
          hasBody: !!node.data?.body,
          hasContent: !!node.data?.content,
          hasMessage: !!node.data?.message,
          data: node.data
        });
      });
      
      // Try different field names for email content
      const emailNodes = nodes.filter(node => {
        if (node.type !== 'email') return false;
        const hasSubject = !!node.data?.subject;
        const hasContent = !!(node.data?.body || node.data?.content || node.data?.message);
        console.log(`📧 Checking ${node.id}:`, { hasSubject, hasContent, data: node.data });
        return hasSubject && hasContent;
      });
      console.log('📧 Found email nodes:', emailNodes.length);
      
      if (emailNodes.length === 0) {
        console.log('❌ No email nodes with content found');
        toast({
          title: "No Email Content",
          description: "Add at least one email step with content to send a test.",
          variant: "destructive",
        });
        return;
      }

      // Use the first email node for testing
      const firstEmailNode = emailNodes[0];
      const subject = firstEmailNode.data?.subject;
      const content = firstEmailNode.data?.body || firstEmailNode.data?.content || firstEmailNode.data?.message;
      console.log('📮 Preparing to send test email:', { subject, contentLength: typeof content === 'string' ? content.length : 'unknown', content });

      const targetEmail = (recipientEmail?.trim()) || user.email;

      // Send test email using the Supabase edge function
      console.log('🚀 Calling send-test-email function...');
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          email: targetEmail,
          subject: subject,
          content: content,
          testName: user.user_metadata?.full_name || 'Test User',
          campaignId: `automation-${automationName?.replace(/\s+/g, '-').toLowerCase()}`
        }
      });

      console.log('📬 Function response:', { data, error });

      if (error) {
        console.log('❌ Function returned error:', error);
        try {
          const server = await (error as any)?.context?.response?.json();
          console.log('🧾 Server error payload:', server);
          const reason = server?.reason || server?.error || error.message;
          const hint = server?.hint ? ` — ${server.hint}` : '';
          throw new Error(`${reason}${hint}`);
        } catch (e) {
          throw new Error((error as any)?.message || 'Failed to send test email');
        }
      }
      
      console.log('✅ Test email sent successfully!');
      toast({
        title: "Test Email Sent! 📧",
        description: `Sent to ${targetEmail}${(data as any)?.usedFrom ? ` — From: ${(data as any).usedFrom}` : ''}`,
      });
    } catch (error) {
      console.error('❌ Test send error:', error);
      toast({
        title: "Test Send Failed",
        description: error instanceof Error ? error.message : "There was an error sending the test email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTestSending(false);
    }
  }, [nodes, automationName, user, toast, isTestSending]);

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
    <div className={`relative w-full ${className}`}>
      <section role="region" aria-label="Automation canvas" className="w-full">
        <div className="w-full rounded-lg bg-muted/30 h-[60vh] min-h-[420px]">
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
            {useMemo(() => (
              <MiniMap
                nodeStrokeColor="#374151"
                nodeColor="#f3f4f6"
                nodeBorderRadius={8}
                maskColor="rgba(0, 0, 0, 0.1)"
                position="top-left"
                style={{ width: 256, height: 160, borderRadius: 8, left: 16, top: 16 }}
                pannable={false}
                zoomable={false}
              />
            ), [])}
          </ReactFlow>
        </div>
      </section>

      {/* Flow Status and Actions Below Canvas */}
      <div className="mt-4 flex flex-col items-center gap-4">
        <FlowStatusBadge 
          nodes={nodes} 
          edges={edges} 
          selectedAudience={selectedAudience} 
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
                  onPersonasChange={onPersonasChange || (() => {})}
                  onSegmentsChange={onSegmentsChange || (() => {})}
                  maxPersonas={3}
                  maxSegments={5}
                  onClose={() => setShowAudienceSelector(false)}
                />
              </div>
            </div>
          </div>
        )}
        
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
        isModalOpen={showAudienceSelector}
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
          triggerType: normalizeTriggerId(triggerType),
          flowSteps: nodes.filter(n => n.type !== 'trigger'),
          selectedAudience
        }}
        onLaunch={handleLaunch}
        onTestSend={handleTestSend}
        isLoading={isLaunchLoading}
        isTestSending={isTestSending}
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

      <AIAssistant
        nodes={nodes}
        hasAudience={hasAudience}
        isReadyToLaunch={isReadyToLaunch}
        onAddNode={handleAddNode}
        onOpenAudienceSelector={() => setShowAudienceSelector(true)}
      />
    </div>
  );
};