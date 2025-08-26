import React, { useState, useMemo } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NewsletterContentBlock } from '@/components/content-sidebar/newsletter/NewsletterContentBlock';
import { useNewsletterImages } from '@/components/content-sidebar/newsletter/useNewsletterImages';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { Edit, Save, X } from 'lucide-react';

interface EditableNewsletterPreviewProps {
  content: string;
  title: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  className?: string;
}

export const EditableNewsletterPreview: React.FC<EditableNewsletterPreviewProps> = ({
  content,
  title,
  onChange,
  onSave,
  className = ""
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [selectedImages, setSelectedImages] = useState<Record<number, string>>({});

  // Process newsletter content to get structured blocks
  const processedNewsletter = useMemo(() => {
    console.log('[NEWSLETTER PREVIEW] Processing content:', { 
      contentLength: content?.length || 0, 
      contentPreview: content?.substring(0, 200),
      title 
    });
    const result = processNewsletterContent(content);
    console.log('[NEWSLETTER PREVIEW] Processed result:', {
      blocksCount: result.blocks?.length || 0,
      unstructuredCount: result.unstructuredSections?.length || 0,
      isStructured: result.isStructured,
      needsRegeneration: result.needsRegeneration,
      blocks: result.blocks,
      unstructured: result.unstructuredSections
    });
    return result;
  }, [content]);

  // Load images for the newsletter blocks
  const { 
    images, 
    imageErrors, 
    loadingImages 
  } = useNewsletterImages(
    processedNewsletter.blocks,
    processedNewsletter.needsRegeneration,
    undefined, // contentTaskId
    processedNewsletter.meta?.theme,
    processedNewsletter.unstructuredSections
  );

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleSave = () => {
    onChange(editContent);
    setIsEditing(false);
    onSave?.();
    // Note: selectedImages will be preserved even after content changes
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleImageSelect = (blockIndex: number, imageUrl: string, metadata?: any) => {
    setSelectedImages(prev => ({
      ...prev,
      [blockIndex]: imageUrl
    }));
  };

  if (isEditing) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit Newsletter Content</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
          
          <RichTextEditor
            content={editContent}
            onChange={setEditContent}
            placeholder="Write your newsletter content..."
            className="min-h-[300px]"
            autoFocus
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className={`relative group ${className}`}>
      {/* Edit button overlay - positioned to not interfere with block controls */}
      <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" onClick={handleStartEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit Content
        </Button>
      </div>

      {/* Newsletter Preview */}
      <div className="p-6">
        {/* Newsletter Header */}
        <div className="mb-8 text-center border-b pb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{sanitizeWeekNumbers(title)}</h1>
          <p className="text-sm text-slate-600">Your Garden Center Newsletter</p>
        </div>

        {/* Newsletter Blocks */}
        <div className="space-y-12">
          {(() => {
            // Render structured blocks if they exist
            if (processedNewsletter.blocks.length > 0) {
              return processedNewsletter.blocks.map((block, index) => {
                const newsletterBlock = {
                  title: block.title || block.headline || `Section ${index + 1}`,
                  body: block.body || block.content || '',
                  cta: block.cta || block.ctaText || '',
                  link: block.link || '',
                  image_prompt: block.image_prompt || '',
                  alt_text: block.alt_text || block.altText || ''
                };

                return (
                  <div key={index} className="border-b border-slate-100 last:border-b-0 pb-12 last:pb-0">
                    <NewsletterContentBlock
                      block={newsletterBlock}
                      index={index}
                      isStructuredNewsletter={processedNewsletter.isStructured}
                      images={images}
                      imageErrors={imageErrors}
                      loadingImages={loadingImages}
                      onImageSelect={handleImageSelect}
                      selectedImages={selectedImages}
                    />
                  </div>
                );
              });
            }
            
            // Render unstructured sections if no structured blocks
            if (processedNewsletter.unstructuredSections && processedNewsletter.unstructuredSections.length > 0) {
              return processedNewsletter.unstructuredSections.map((section, index) => {
                const newsletterBlock = {
                  title: section.title || `Section ${index + 1}`,
                  body: section.content || '',
                  cta: '',
                  link: '',
                  image_prompt: section.image_prompt || '',
                  alt_text: ''
                };

                return (
                  <div key={`unstructured-${index}`} className="border-b border-slate-100 last:border-b-0 pb-12 last:pb-0">
                    <NewsletterContentBlock
                      block={newsletterBlock}
                      index={index}
                      isStructuredNewsletter={false}
                      images={images}
                      imageErrors={imageErrors}
                      loadingImages={loadingImages}
                      onImageSelect={handleImageSelect}
                      selectedImages={selectedImages}
                    />
                  </div>
                );
              });
            }

            // Show empty state only if no content at all
            return (
              <div className="text-center py-8 text-slate-500">
                <p>Click edit to add newsletter content</p>
              </div>
            );
          })()}
        </div>

        {/* Newsletter Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Your Garden Center | All rights reserved</p>
          <p className="mt-1">
            <a href="#" className="hover:text-primary">Unsubscribe</a> | 
            <a href="#" className="hover:text-primary ml-1">Update preferences</a>
          </p>
        </div>
      </div>
    </Card>
  );
};