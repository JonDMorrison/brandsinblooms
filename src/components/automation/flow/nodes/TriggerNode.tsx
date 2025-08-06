import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Settings } from 'lucide-react';

export interface TriggerNodeData {
  triggerType: string;
  label: string;
  conditions?: Record<string, any>;
}

const TriggerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data as unknown) as TriggerNodeData;
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <Badge variant="secondary" className="text-xs">
              TRIGGER
            </Badge>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>
        
        <div>
          <h3 className="font-medium text-sm mb-1">{nodeData.label}</h3>
          <p className="text-xs text-muted-foreground">
            {nodeData.triggerType === 'loyalty_join' && 'When customer joins loyalty program'}
            {nodeData.triggerType === 'first_purchase' && 'After customer first purchase'}
            {nodeData.triggerType === 'birthday' && 'On customer birthday'}
            {nodeData.triggerType === 'cart_abandonment' && 'When cart is abandoned'}
          </p>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-green-500 !border-green-600"
        />
      </CardContent>
    </Card>
  );
};

export default memo(TriggerNode);