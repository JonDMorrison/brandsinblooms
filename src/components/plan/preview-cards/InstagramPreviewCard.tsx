import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, Edit2, RefreshCw, Image as ImageIcon, Heart, MessageCircle, Send } from 'lucide-react';
import { PlanItem } from '../constants';
import { format } from 'date-fns';

interface InstagramPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

export const InstagramPreviewCard: React.FC<InstagramPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
  onImageSelect
}) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-card border-2 hover:border-primary/40">
      {/* Instagram Header */}
      <div className="p-3 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center">
          <Instagram className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">yourbusiness</div>
          <div className="text-xs text-muted-foreground">{format(item.date, 'MMM d')}</div>
        </div>
        <Button size="sm" variant="ghost" className="h-8 px-2">
          <span className="text-xl">···</span>
        </Button>
      </div>

      {/* Instagram Image - AI Generation Placeholder */}
      <CardContent className="p-0">
        <div 
          className="w-full aspect-square bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center"
        >
          <div className="text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 text-primary/60 animate-pulse" />
            <p className="text-sm font-medium text-foreground">AI will generate image after launch</p>
            <p className="text-xs text-muted-foreground mt-1">Based on: {item.imageIdea || item.themeName}</p>
          </div>
        </div>

        {/* Engagement Bar */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Heart className="h-6 w-6 text-foreground" />
              <MessageCircle className="h-6 w-6 text-foreground" />
              <Send className="h-6 w-6 text-foreground" />
            </div>
          </div>

          {/* Caption */}
          <div className="text-sm">
            <span className="font-semibold mr-2">yourbusiness</span>
            <span className="text-foreground/80">{item.caption}</span>
          </div>
        </div>

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
            📸 Instagram
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
