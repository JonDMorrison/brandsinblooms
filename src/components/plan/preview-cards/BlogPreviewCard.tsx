import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Edit2, RefreshCw, Image as ImageIcon, Clock } from 'lucide-react';
import { PlanItem } from '../constants';
import { format } from 'date-fns';

interface BlogPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

export const BlogPreviewCard: React.FC<BlogPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
  onImageSelect
}) => {
  const truncateText = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  };

  const estimatedReadTime = Math.ceil(item.caption.split(' ').length / 200);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-card border-2 hover:border-primary/40">
      {/* Blog Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-100 dark:from-purple-950/20 dark:to-indigo-900/20 p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="text-sm font-semibold text-foreground">Blog Post</div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {estimatedReadTime} min read
          </div>
        </div>
        <h3 className="font-bold text-lg text-foreground leading-tight">
          {item.title}
        </h3>
      </div>

      {/* Blog Content Preview */}
      <CardContent className="p-4 space-y-3">
        {/* Featured Image Picker Button */}
        <button
          onClick={onImageSelect}
          className="w-full h-48 rounded-lg bg-gradient-to-br from-muted/30 to-muted/50 flex flex-col items-center justify-center hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-pointer group"
        >
          <ImageIcon className="h-12 w-12 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="text-sm font-medium text-foreground mb-1">Choose Image</p>
          <p className="text-xs text-muted-foreground">Click to select from library or upload</p>
        </button>

        {/* Blog Excerpt */}
        <div className="text-sm text-foreground/80 leading-relaxed">
          {truncateText(item.caption, 250)}
        </div>

        {/* Read More Link */}
        <div className="pt-2">
          <span className="text-sm text-primary font-medium hover:underline cursor-pointer">
            Read full article →
          </span>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
          <span>Published {format(item.date, 'MMM d, yyyy')}</span>
          <span>·</span>
          <span>{item.themeName || 'Seasonal'}</span>
        </div>
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
          📝 Blog
        </div>
      </div>
    </Card>
  );
};
