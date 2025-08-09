import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Mail, 
  MessageSquare, 
  Clock, 
  GitBranch,
  Sparkles,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FloatingToolbarProps {
  onAddNode: (nodeType: string, position?: { x: number; y: number }) => void;
  selectedNodeId: string | null;
  onToggleAISuggestions: () => void;
  showAISuggestions: boolean;
  isModalOpen?: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onAddNode,
  selectedNodeId,
  onToggleAISuggestions,
  showAISuggestions,
  isModalOpen = false,
}) => {
  const nodeTypes = [
    {
      type: 'trigger',
      label: 'Trigger',
      icon: Zap,
      color: 'text-green-600',
      description: 'Start automation',
    },
    {
      type: 'email',
      label: 'Email',
      icon: Mail,
      color: 'text-blue-600',
      description: 'Send email',
    },
    {
      type: 'sms',
      label: 'SMS',
      icon: MessageSquare,
      color: 'text-purple-600',
      description: 'Send SMS',
    },
    {
      type: 'delay',
      label: 'Delay',
      icon: Clock,
      color: 'text-orange-600',
      description: 'Wait period',
    },
    {
      type: 'split',
      label: 'Split',
      icon: GitBranch,
      color: 'text-indigo-600',
      description: 'Branch flow',
    },
  ];

  if (isModalOpen) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50 space-y-3 w-64 interactive">
      {/* Add Node Toolbar */}
      <Card className="border w-full">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Step</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {nodeTypes.map((nodeType) => {
              const Icon = nodeType.icon;
              return (
                <Button
                  key={nodeType.type}
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddNode(nodeType.type)}
                  className="justify-start gap-2 h-auto p-2 w-full"
                >
                  <Icon className={`w-4 h-4 ${nodeType.color}`} />
                  <div className="text-left">
                    <div className="text-sm font-medium">{nodeType.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {nodeType.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      {selectedNodeId && (
        <Card className="border w-full">
          <CardContent className="p-3">
            <Button
              variant={showAISuggestions ? "default" : "ghost"}
              size="sm"
              onClick={onToggleAISuggestions}
              className="w-full justify-start gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Suggestions</span>
              {showAISuggestions && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  ON
                </Badge>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};