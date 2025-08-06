import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SplitNodeData {
  splitType: 'conditional' | 'ab_test' | 'random';
  conditions?: Array<{
    label: string;
    condition: string;
  }>;
  editable?: boolean;
}

const SplitNode: React.FC<NodeProps> = ({ 
  data, 
  selected,
  id 
}) => {
  const nodeData = (data as unknown) as SplitNodeData;
  const getSplitTypeLabel = () => {
    switch (nodeData.splitType) {
      case 'conditional':
        return 'Conditional Split';
      case 'ab_test':
        return 'A/B Test';
      case 'random':
        return 'Random Split';
      default:
        return 'Split';
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete split node:', id);
  };

  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-indigo-500 !border-indigo-600"
        />

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
              SPLIT
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
        
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{getSplitTypeLabel()}</h4>
          
          {nodeData.conditions && nodeData.conditions.length > 0 ? (
            <div className="space-y-1">
              {nodeData.conditions.map((condition, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  • {condition.label}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click to configure split conditions
            </p>
          )}
        </div>

        {/* Multiple source handles for split outputs */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="branch-a"
          style={{ left: '30%' }}
          className="w-3 h-3 !bg-indigo-500 !border-indigo-600"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="branch-b"
          style={{ left: '70%' }}
          className="w-3 h-3 !bg-indigo-500 !border-indigo-600"
        />
      </CardContent>
    </Card>
  );
};

export default memo(SplitNode);