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
    <Card className={`p-3 shadow-lg border-2 border-primary/20 ${className}`}>
      <div className="space-y-3">
        <MediaSelectorImage
          src={imageUrl}
          onChange={handleImageChange}
          contentContext={contentContext}
          className="w-full"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Done
          </Button>
        </div>
      </div>
    </Card>
  );
};