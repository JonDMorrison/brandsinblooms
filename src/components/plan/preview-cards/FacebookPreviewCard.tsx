import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Facebook, Edit2, RefreshCw, Image as ImageIcon, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { PlanItem } from '../constants';
import { format } from 'date-fns';

interface FacebookPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

export const FacebookPreviewCard: React.FC<FacebookPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
  onImageSelect
}) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-card border-2 hover:border-primary/40">
      {/* Facebook Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <Facebook className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Your Business Name</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {format(item.date, 'MMM d')} · 🌎
            </div>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <CardContent className="p-0">
        {/* Text Content */}
        <div className="p-4 text-sm text-foreground whitespace-pre-wrap">
          {item.caption}
        </div>

        {/* Image */}
        {item.imageUrl ? (
          <div className="relative w-full h-72 group">
            <img 
              src={item.imageUrl} 
              alt="Facebook post" 
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
        ) : (
          <div 
            className="w-full h-72 bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors border-y"
            onClick={onImageSelect}
          >
            <div className="text-center">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to add image</p>
            </div>
          </div>
        )}

        {/* Facebook Engagement Bar */}
        <div className="border-t border-b bg-muted/10">
          <div className="flex items-center justify-around py-2 text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <ThumbsUp className="h-4 w-4" />
              <span>Like</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MessageCircle className="h-4 w-4" />
              <span>Comment</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-muted/20 p-3 flex items-center justify-between">
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
            📘 Facebook
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
