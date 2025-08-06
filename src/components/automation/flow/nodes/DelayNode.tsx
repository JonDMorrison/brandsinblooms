import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DelayNodeData {
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  editable?: boolean;
}

const DelayNode: React.FC<NodeProps> = ({ 
  data, 
  selected,
  id 
}) => {
  const nodeData = (data as unknown) as DelayNodeData;
  const getDelayText = () => {
    const { delayValue, delayUnit } = nodeData;
    if (delayValue === 0) return 'Immediate';
    if (delayValue === 1) return `1 ${delayUnit.slice(0, -1)}`;
    return `${delayValue} ${delayUnit}`;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete delay node:', id);
  };

  return (
    <Card className={`min-w-[180px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-orange-500 !border-orange-600"
        />

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700">
              DELAY
            </Badge>
          </div>
          <div className="flex gap-1">
            <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-auto p-0 w-4 h-4 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="text-center">
          <h4 className="font-medium text-sm mb-1">Wait</h4>
          <p className="text-lg font-bold text-orange-600">
            {getDelayText()}
          </p>
          <p className="text-xs text-muted-foreground">
            before next action
          </p>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-orange-500 !border-orange-600"
        />
      </CardContent>
    </Card>
  );
};

export default memo(DelayNode);