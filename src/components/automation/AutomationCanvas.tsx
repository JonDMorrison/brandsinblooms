import React from 'react';
import { Button } from '@/components/ui/button';
import { AIAssistant } from './flow/AIAssistant';

interface FlowState {
  nodes: any[];
  edges: any[];
}

interface AutomationCanvasProps {
  flowState: FlowState;
  onFlowStateChange: (state: FlowState) => void;
}

export const AutomationCanvas: React.FC<AutomationCanvasProps> = ({
  flowState,
  onFlowStateChange,
}) => {
  return (
    <section role="region" aria-label="Automation canvas" className="w-full responsive-padding">
      <div className="w-full rounded-lg bg-muted/30 flex items-center justify-center min-h-[360px] md:min-h-[520px] max-h-[calc(100vh-220px)]">
        {flowState?.nodes?.length === 0 && flowState?.edges?.length === 0 ? (
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
        ) : (
          <div className="w-full h-full" aria-hidden />
        )}
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
