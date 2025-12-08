import React, { useState } from 'react';
import { ContentBlock, GalleryItem } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, Check } from 'lucide-react';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductGalleryImageSlot } from './ProductGalleryImageSlot';

interface ProductGalleryBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onClose?: () => void;
  isGenerating?: boolean;
}

export const ProductGalleryBlockEditor: React.FC<ProductGalleryBlockEditorProps> = ({
  block,
  onUpdate,
  onClose,
  isGenerating = false,
}) => {
  const { toast } = useToast();
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [generatingSlots, setGeneratingSlots] = useState<Set<number>>(new Set());

  const galleryItems: GalleryItem[] = block.galleryItems || [];

  // Add a new empty product slot
  const addProduct = () => {
    if (galleryItems.length >= 4) {
      toast({
        title: "Maximum reached",
        description: "Product gallery supports up to 4 items.",
      });
      return;
    }

    const newItem: GalleryItem = {
      id: `product_${Date.now()}_${galleryItems.length}`,
      title: '',
      imageUrl: '',
    };

    onUpdate({
      galleryItems: [...galleryItems, newItem],
      userEdited: true,
    });
  };

  // Remove a product
  const removeProduct = (index: number) => {
    const newItems = galleryItems.filter((_, i) => i !== index);
    onUpdate({
      galleryItems: newItems,
      userEdited: true,
    });
  };

  // Update a specific product field
  const updateProduct = (index: number, field: keyof GalleryItem, value: string) => {
    const newItems = [...galleryItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onUpdate({
      galleryItems: newItems,
      userEdited: true,
    });
  };

  // Handle image selection from media selector
  const handleImageSelect = (index: number, imageUrl: string) => {
    updateProduct(index, 'imageUrl', imageUrl);
    setMediaSelectorOpen(false);
    setActiveSlotIndex(null);
  };

  // Open media selector for a specific slot
  const openMediaSelectorForSlot = (index: number) => {
    setActiveSlotIndex(index);
    setMediaSelectorOpen(true);
  };

  // Generate AI image for a product slot
  const generateImageForSlot = async (index: number) => {
    setGeneratingSlots(prev => new Set(prev).add(index));

    try {
      const item = galleryItems[index];
      const contentContext = [
        block.headline,
        block.body,
        item?.title || `product ${index + 1}`,
      ].filter(Boolean).join(' - ');

      const { data, error } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          channel: 'email',
          contentType: 'product',
          headline: item?.title || 'Product Image',
          bodyText: block.body || '',
          additionalContext: contentContext,
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        handleImageSelect(index, data.imageUrl);
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
      toast({
        title: "Image generation failed",
        description: "Please try again or upload an image manually.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSlots(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Headline */}
      <div className="space-y-2">
        <Label htmlFor="product-gallery-headline">Headline</Label>
        <Input
          id="product-gallery-headline"
          value={block.headline || ''}
          onChange={(e) => onUpdate({ 
            headline: e.target.value, 
            title: e.target.value,
            userEdited: true 
          })}
          placeholder="Bring the Holiday Season to Life"
          className="text-lg font-semibold"
        />
      </div>

      {/* Subheadline / Body */}
      <div className="space-y-2">
        <Label htmlFor="product-gallery-body">Subheadline</Label>
        <Input
          id="product-gallery-body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ 
            body: e.target.value, 
            content: e.target.value,
            userEdited: true 
          })}
          placeholder="Transform your space with festive favorites..."
        />
      </div>

      {/* Products Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Products ({galleryItems.length}/4)</Label>
          {galleryItems.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addProduct}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {galleryItems.map((item, index) => (
            <div 
              key={item.id} 
              className="relative rounded-lg border bg-card p-3 space-y-3"
            >
              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removeProduct(index)}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Image */}
              <ProductGalleryImageSlot
                imageUrl={item.imageUrl}
                title={item.title}
                index={index}
                isGenerating={generatingSlots.has(index)}
                onOpenMediaSelector={() => openMediaSelectorForSlot(index)}
                onOpenAIDialog={() => generateImageForSlot(index)}
                onImageRemove={() => updateProduct(index, 'imageUrl', '')}
              />

              {/* Title */}
              <Input
                value={item.title || ''}
                onChange={(e) => updateProduct(index, 'title', e.target.value)}
                placeholder="Product name"
                className="text-sm"
              />

              {/* Badge Text */}
              <Input
                value={item.badgeText || ''}
                onChange={(e) => updateProduct(index, 'badgeText', e.target.value)}
                placeholder="25% OFF"
                className="text-xs"
              />

              {/* URL */}
              <Input
                value={item.url || ''}
                onChange={(e) => updateProduct(index, 'url', e.target.value)}
                placeholder="https://..."
                className="text-xs"
              />
            </div>
          ))}

          {/* Empty slots placeholder */}
          {galleryItems.length < 4 && Array.from({ length: 4 - galleryItems.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center cursor-pointer hover:border-muted-foreground/40 transition-colors"
              onClick={addProduct}
            >
              <div className="text-center text-muted-foreground">
                <Plus className="h-8 w-8 mx-auto mb-1" />
                <span className="text-xs">Add</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-sm font-medium">Call to Action</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="product-cta-text" className="text-xs">Button Text</Label>
            <Input
              id="product-cta-text"
              value={block.ctaText || ''}
              onChange={(e) => onUpdate({ 
                ctaText: e.target.value, 
                buttonText: e.target.value,
                userEdited: true 
              })}
              placeholder="Shop Holiday"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-cta-url" className="text-xs">Button URL</Label>
            <Input
              id="product-cta-url"
              value={block.ctaUrl || ''}
              onChange={(e) => onUpdate({ 
                ctaUrl: e.target.value, 
                buttonUrl: e.target.value,
                userEdited: true 
              })}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Save & Close Button */}
      {onClose && (
        <div className="pt-4 border-t">
          <Button
            onClick={onClose}
            className="w-full gap-2"
          >
            <Check className="h-4 w-4" />
            Save & Close
          </Button>
        </div>
      )}

      {/* Media Selector Sidebar */}
      <MediaSelectorSidebar
        isOpen={mediaSelectorOpen}
        onClose={() => {
          setMediaSelectorOpen(false);
          setActiveSlotIndex(null);
        }}
        onImageSelect={(imageUrl) => {
          if (activeSlotIndex !== null) {
            handleImageSelect(activeSlotIndex, imageUrl);
          }
        }}
        contentContext={block.headline || 'Product image'}
      />
    </div>
  );
};
