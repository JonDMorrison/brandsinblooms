import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AIAssistant } from './flow/AIAssistant';
import { 
  ReactFlow, 
  ReactFlowProvider,
  useReactFlow, 
  getNodesBounds,
  Background,
  Controls,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface FlowState {
  nodes: any[];
  edges: any[];
}

interface AutomationCanvasProps {
  flowState: FlowState;
  onFlowStateChange: (state: FlowState) => void;
}

const FlowCanvas: React.FC<{ flowState: FlowState; onFlowStateChange: (state: FlowState) => void }> = ({ 
  flowState, 
  onFlowStateChange 
}) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (flowState?.nodes?.length > 0) {
      // Set initial zoom based on screen size
      const isMobile = window.innerWidth < 768;
      const targetZoom = isMobile ? 0.9 : 1.05;
      
      setTimeout(() => {
        fitView({
          padding: 24,
          minZoom: 0.5,
          maxZoom: 1.5,
          duration: 300
        });
        
        // Apply the target zoom after fitView
        setTimeout(() => {
          const bounds = getNodesBounds(flowState.nodes);
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;
          
          fitView({
            padding: 24,
            minZoom: targetZoom,
            maxZoom: targetZoom,
            duration: 200
          });
        }, 100);
      }, 50);
    }
  }, [flowState?.nodes?.length, fitView]);

  if (flowState?.nodes?.length === 0 && flowState?.edges?.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <p className="mb-3">Start by choosing a goal on the left or add a trigger to begin.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFlowStateChange({ ...flowState })}
        >
          Refresh Canvas
        </Button>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={flowState.nodes}
      edges={flowState.edges}
      fitView
      fitViewOptions={{
        padding: 24,
        minZoom: 0.5,
        maxZoom: 1.5
      }}
      style={{ backgroundColor: 'hsl(var(--muted))' }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};

export const AutomationCanvas: React.FC<AutomationCanvasProps> = ({
  flowState,
  onFlowStateChange,
}) => {
  return (
    <section role="region" aria-label="Automation canvas" className="w-full responsive-padding">
      <div className="w-full rounded-lg bg-muted/30 min-h-[360px] md:min-h-[520px] max-h-[calc(100vh-220px)]">
        <ReactFlowProvider>
          <FlowCanvas flowState={flowState} onFlowStateChange={onFlowStateChange} />
        </ReactFlowProvider>
      </div>

      <AIAssistant
        nodes={flowState?.nodes || []}
        hasAudience={false}
        isReadyToLaunch={false}
        onAddNode={(type) => console.warn('onAddNode not wired in AutomationCanvas yet:', type)}
        onOpenAudienceSelector={() => console.warn('onOpenAudienceSelector not wired in AutomationCanvas yet')}
      />
    </section>
  );
};
