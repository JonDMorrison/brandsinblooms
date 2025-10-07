import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sample images for the grid (using Unsplash garden/plant images)
const sampleImages = [
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1563691243940-4f4e3e5b9f3c?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=400&fit=crop',
];

export const AIPersonalizationDialog: React.FC<AIPersonalizationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Personalization</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-foreground mb-4">
            Select a style to personalize your image with AI
          </p>
          
          <div className="grid grid-cols-5 gap-4 w-full">
            {sampleImages.map((image, index) => (
              <div
                key={index}
                onClick={() => setSelectedImage(image)}
                className={`
                  relative aspect-square rounded-lg overflow-hidden cursor-pointer
                  transition-all duration-200 hover:scale-105 hover:shadow-lg
                  bg-muted
                  ${selectedImage === image ? 'ring-4 ring-primary shadow-xl' : 'ring-1 ring-border'}
                `}
                style={{ minHeight: '120px', minWidth: '120px' }}
              >
                <img
                  src={image}
                  alt={`Style ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => {
                    console.error('Failed to load image:', image);
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => console.log('Image loaded:', index)}
                />
                {selectedImage === image && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10">
                    <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      ✓
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt" className="text-sm font-medium">
                Describe your personalization
              </Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how you want to personalize this image (e.g., 'Make it more vibrant', 'Add spring flowers', 'Create a sunset atmosphere')..."
                rows={4}
                className="resize-none"
              />
            </div>
            <Button
              className="w-full"
              disabled={!selectedImage || !prompt.trim()}
            >
              Generate Personalized Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
