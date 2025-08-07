import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Settings, Trash2 } from 'lucide-react';

export interface DelayNodeData {
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  editable?: boolean;
  [key: string]: unknown;
}

interface DelayNodeProps {
  id: string;
  data: DelayNodeData;
  selected?: boolean;
  onEdit?: (nodeId: string, nodeType: string, nodeData: any) => void;
  onDelete?: (nodeId: string) => void;
}

const DelayNode: React.FC<DelayNodeProps> = ({ 
  id, 
  data, 
  selected, 
  onEdit, 
  onDelete 
}) => {
  const nodeData = data as DelayNodeData;

  const getDelayText = () => {
    if (nodeData.delayValue === 1) {
      return `Wait 1 ${nodeData.delayUnit.slice(0, -1)}`;
    }
    return `Wait ${nodeData.delayValue} ${nodeData.delayUnit}`;
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id, 'delay', nodeData);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCardClick = () => {
    onEdit?.(id, 'delay', nodeData);
  };

  return (
    <Card 
      className={`min-w-[200px] cursor-pointer hover:shadow-md transition-shadow ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-orange-500 !border-orange-600"
        />
        
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="text-xs">
              DELAY
            </Badge>
          </div>
          <div className="flex gap-1">
            <Settings 
              className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" 
              onClick={handleEdit}
            />
            <Trash2 
              className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-destructive" 
              onClick={handleDelete}
            />
          </div>
        </div>
        
        <div className="text-center">
          <h3 className="font-medium text-sm mb-1">
            {getDelayText()}
          </h3>
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