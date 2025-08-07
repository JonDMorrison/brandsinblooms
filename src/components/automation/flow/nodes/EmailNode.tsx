import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Settings, Trash2 } from 'lucide-react';

export interface EmailNodeData {
  subject?: string;
  content?: string;
  template?: string;
  editable?: boolean;
  [key: string]: unknown;
}

interface EmailNodeProps {
  id: string;
  data: EmailNodeData;
  selected?: boolean;
  onEdit?: (nodeId: string, nodeType: string, nodeData: any) => void;
  onDelete?: (nodeId: string) => void;
}

const EmailNode: React.FC<EmailNodeProps> = ({ 
  id, 
  data, 
  selected, 
  onEdit, 
  onDelete 
}) => {
  const nodeData = data as EmailNodeData;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id, 'email', nodeData);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCardClick = () => {
    onEdit?.(id, 'email', nodeData);
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
          className="w-3 h-3 !bg-blue-500 !border-blue-600"
        />
        
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="text-xs">
              EMAIL
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
          <h3 className="font-medium text-sm mb-1">
            {nodeData.subject || 'Email Message'}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {nodeData.content || 'Click to edit email content...'}
          </p>
          
          {nodeData.template && (
            <Badge variant="outline" className="text-xs mt-2">
              Template: {nodeData.template}
            </Badge>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-blue-500 !border-blue-600"
        />
      </CardContent>
    </Card>
  );
};

export default memo(EmailNode);