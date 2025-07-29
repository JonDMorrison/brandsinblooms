import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface InlineImageEditorProps {
  imageUrl?: string;
  onChange: (imageUrl: string) => void;
  onSave: () => void;
  onCancel: () => void;
  contentContext?: string;
  className?: string;
}

export const InlineImageEditor: React.FC<InlineImageEditorProps> = ({
  imageUrl,
  onChange,
  onSave,
  onCancel,
  contentContext = "Email content image",
  className = ""
}) => {
  const handleImageChange = (newImageUrl: string) => {
    onChange(newImageUrl);
    // Auto-save on image selection for better UX
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-start justify-center p-4 backdrop-blur">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-primary/20">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Image</h3>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              ✕
            </Button>
          </div>
          
          <MediaSelectorImage
            src={imageUrl}
            onChange={handleImageChange}
            contentContext={contentContext}
            className="w-full min-h-[400px]"
          />
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};