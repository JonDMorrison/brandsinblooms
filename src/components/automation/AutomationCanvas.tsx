import React from 'react';
import { Button } from '@/components/ui/button';

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
    <section role="region" aria-label="Automation canvas" className="h-full w-full p-4 md:p-6">
      <div className="h-full min-h-[60vh] w-full rounded-lg border border-dashed bg-background flex items-center justify-center">
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
      </div>
    </section>
  );
};
