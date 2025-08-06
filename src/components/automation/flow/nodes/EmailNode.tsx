import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EmailNodeData {
  subject?: string;
  content?: string;
  template?: string;
  editable?: boolean;
}

const EmailNode: React.FC<NodeProps> = ({ 
  data, 
  selected,
  id 
}) => {
  const nodeData = (data as unknown) as EmailNodeData;
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete email node:', id);
  };

  return (
    <Card className={`min-w-[220px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-blue-500 !border-blue-600"
        />

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
              EMAIL
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
            <h4 className="font-medium text-sm">
              {nodeData.subject || 'Email Message'}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {nodeData.content || 'Click to edit email content...'}
            </p>
          </div>
          
          {nodeData.template && (
            <Badge variant="outline" className="text-xs">
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