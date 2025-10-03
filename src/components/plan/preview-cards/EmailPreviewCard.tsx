import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Edit2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { PlanItem } from '../constants';
import { format } from 'date-fns';

interface EmailPreviewCardProps {
  item: PlanItem;
  onEdit: () => void;
  onRegenerate: () => void;
  onImageSelect: () => void;
}

export const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({
  item,
  onEdit,
  onRegenerate,
  onImageSelect
}) => {
  const truncateText = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-card border-2 hover:border-primary/40">
      {/* Email Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Your Business Name</div>
              <div className="text-xs text-muted-foreground">newsletter@yourbusiness.com</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {format(item.date, 'MMM d')}
          </div>
        </div>
        <div className="font-semibold text-base text-foreground">
          {item.title}
        </div>
      </div>

      {/* Email Body Preview */}
      <CardContent className="p-4 space-y-3">
        {/* Featured Image Placeholder */}
        {item.imageUrl ? (
          <div className="relative w-full h-40 rounded-lg overflow-hidden group">
            <img 
              src={item.imageUrl} 
              alt="Email featured" 
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
            className="w-full h-40 bg-muted/30 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed border-muted-foreground/30"
            onClick={onImageSelect}
          >
            <div className="text-center">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to add image</p>
            </div>
          </div>
        )}

        {/* Email Content Preview */}
        <div className="text-sm text-foreground/80 leading-relaxed">
          {truncateText(item.caption, 200)}
        </div>

        {/* CTA Button Preview */}
        <div className="pt-2">
          <div className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
            Learn More
          </div>
        </div>

        {/* Footer Preview */}
        <div className="pt-4 mt-4 border-t text-xs text-muted-foreground text-center">
          You're receiving this because you subscribed to our newsletter
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
          📧 Email
        </div>
      </div>
    </Card>
  );
};
