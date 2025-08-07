import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Settings, Trash2 } from 'lucide-react';

export interface SMSNodeData {
  content?: string;
  characterCount?: number;
  editable?: boolean;
  [key: string]: unknown;
}

interface SMSNodeProps {
  id: string;
  data: SMSNodeData;
  selected?: boolean;
  onEdit?: (nodeId: string, nodeType: string, nodeData: any) => void;
  onDelete?: (nodeId: string) => void;
}

const SMSNode: React.FC<SMSNodeProps> = ({ 
  id, 
  data, 
  selected, 
  onEdit, 
  onDelete 
}) => {
  const nodeData = data as SMSNodeData;
  const characterCount = nodeData.content?.length || 0;
  const isOverLimit = characterCount > 160;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id, 'sms', nodeData);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCardClick = () => {
    onEdit?.(id, 'sms', nodeData);
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
          className="w-3 h-3 !bg-green-500 !border-green-600"
        />
        
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="text-xs">
              SMS
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
        
        <div>
          <h3 className="font-medium text-sm mb-1">SMS Message</h3>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {nodeData.content || 'Click to edit SMS content...'}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <Badge 
              variant={isOverLimit ? "destructive" : "outline"} 
              className="text-xs"
            >
              {characterCount}/160 chars
            </Badge>
            {isOverLimit && (
              <span className="text-xs text-destructive">
                Too long
              </span>
            )}
          </div>
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

export default memo(SMSNode);