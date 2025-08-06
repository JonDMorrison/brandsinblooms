import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SMSNodeData {
  content?: string;
  characterCount?: number;
  editable?: boolean;
}

const SMSNode: React.FC<NodeProps> = ({ 
  data, 
  selected,
  id 
}) => {
  const nodeData = (data as unknown) as SMSNodeData;
  const characterCount = nodeData.content?.length || 0;
  const isOverLimit = characterCount > 160;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete SMS node:', id);
  };

  return (
    <Card className={`min-w-[220px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-purple-500 !border-purple-600"
        />

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700">
              SMS
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
          <div>
            <h4 className="font-medium text-sm">SMS Message</h4>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {nodeData.content || 'Click to edit SMS content...'}
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <Badge 
              variant={isOverLimit ? "destructive" : "outline"} 
              className="text-xs"
            >
              {characterCount}/160 chars
            </Badge>
            {isOverLimit && (
              <span className="text-xs text-destructive">
                Multiple messages
              </span>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-purple-500 !border-purple-600"
        />
      </CardContent>
    </Card>
  );
};

export default memo(SMSNode);