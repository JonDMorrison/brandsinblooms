
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
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p className="mb-3">Automation Canvas placeholder</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFlowStateChange({ ...flowState })}
        >
          Refresh Canvas
        </Button>
      </div>
    </div>
  );
};
