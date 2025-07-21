
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ContentBlock } from '@/types/emailBuilder';

interface QuickAddBlocksProps {
  onAddBlock: (type: ContentBlock['type']) => void;
}

export const QuickAddBlocks: React.FC<QuickAddBlocksProps> = ({
  onAddBlock
}) => {
  const quickBlocks = [
    { 
      type: 'header' as const, 
      label: 'Header', 
      icon: '📄',
      description: 'Title and hero section'
    },
    { 
      type: 'text' as const, 
      label: 'Text', 
      icon: '📝',
      description: 'Paragraph content'
    },
    { 
      type: 'image' as const, 
      label: 'Image', 
      icon: '🖼️',
      description: 'Photos and graphics'
    },
    { 
      type: 'button' as const, 
      label: 'Button', 
      icon: '🔘',
      description: 'Call-to-action'
    },
    { 
      type: 'product' as const, 
      label: 'Product', 
      icon: '📦',
      description: 'Product showcase'
    },
    { 
      type: 'divider' as const, 
      label: 'Divider', 
      icon: '➖',
      description: 'Section separator'
    }
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Add Content Block</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {quickBlocks.map(({ type, label, icon, description }) => (
            <Button
              key={type}
              variant="outline"
              onClick={() => onAddBlock(type)}
              className="h-auto p-3 flex flex-col gap-1 hover:bg-primary/5 hover:border-primary/20"
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
              <span className="text-xs text-muted-foreground leading-tight">{description}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
