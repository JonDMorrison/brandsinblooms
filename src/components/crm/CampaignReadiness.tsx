import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadinessItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  description?: string;
}

interface CampaignReadinessProps {
  campaignName: string;
  subjectLine: string;
  blocks: any[];
  selectedSegments: any[];
  senderConfig?: any;
  className?: string;
  onEditAudience?: () => void;
}

export const CampaignReadiness: React.FC<CampaignReadinessProps> = ({
  campaignName,
  subjectLine,
  blocks,
  selectedSegments,
  senderConfig,
  className = '',
  onEditAudience
}) => {
  const items: ReadinessItem[] = [
    {
      id: 'name',
      label: 'Campaign name',
      completed: Boolean(campaignName?.trim()),
      required: true,
      description: 'Give your campaign a descriptive name'
    },
    {
      id: 'subject',
      label: 'Subject line',
      completed: Boolean(subjectLine?.trim()),
      required: true,
      description: 'Add an engaging subject line'
    },
    {
      id: 'content',
      label: 'Email content',
      completed: blocks.length > 0,
      required: true,
      description: 'Add content blocks to your email'
    },
    {
      id: 'audience',
      label: 'Audience selected',
      completed: true, // All Contacts is valid by default; targeting is optional
      required: true,
      description: 'Choose who will receive this campaign'
    },
    {
      id: 'sender',
      label: 'Sender verified',
      completed: senderConfig?.isVerified || false,
      required: false,
      description: 'Domain verification improves deliverability'
    }
  ];

  const requiredItems = items.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => item.completed).length;
  const totalRequired = requiredItems.length;
  const isReady = completedRequired === totalRequired;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium">Send Readiness</h4>
          <Badge variant={isReady ? "default" : "secondary"} className="text-xs">
            {completedRequired}/{totalRequired} required
          </Badge>
        </div>
        
        {isReady ? (
          <div className="flex items-center space-x-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Ready to Send</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Needs attention</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {items.map((item) => {
          const isClickable = item.id === 'audience' && onEditAudience;
          
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center space-x-2 text-sm",
                isClickable && "cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
              )}
              onClick={isClickable ? onEditAudience : undefined}
            >
              {item.completed ? (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "font-medium",
                  item.completed ? "text-foreground" : "text-muted-foreground",
                  isClickable && "hover:text-primary"
                )}>
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};