import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Edit2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { PlanItem } from '../constants';
import { format } from 'date-fns';

interface SMSPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

export const SMSPreviewCard: React.FC<SMSPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
  onImageSelect
}) => {
  const charCount = item.caption.length;
  const segmentCount = Math.ceil(charCount / 160);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-card border-2 hover:border-primary/40">
      {/* SMS Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-900/20 p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">SMS Message</div>
              <div className="text-xs text-muted-foreground">To: Your Customers</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {format(item.date, 'MMM d')}
          </div>
        </div>
      </div>

      {/* SMS Body Preview */}
      <CardContent className="p-4 space-y-3">
        {/* Message Bubble */}
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm p-4 max-w-[85%]">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {item.caption}
          </div>
        </div>

        {/* Character Count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
          <span>{charCount} characters · {segmentCount} segment{segmentCount > 1 ? 's' : ''}</span>
          {charCount > 160 && (
            <span className="text-amber-600">Multiple SMS segments</span>
          )}
        </div>

        {/* Media Preview */}
        {item.imageUrl && (
          <div className="relative w-full h-32 rounded-lg overflow-hidden group">
            <img 
              src={item.imageUrl} 
              alt="SMS media" 
              className="w-full h-full object-cover"
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onImageSelect}
            >
              <ImageIcon className="h-3 w-3 mr-1" />
              Change
            </Button>
          </div>
        )}
      </CardContent>

      {/* Action Buttons */}
      <div className="border-t bg-muted/20 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="gap-1"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            className="gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          💬 SMS
        </div>
      </div>
    </Card>
  );
};
