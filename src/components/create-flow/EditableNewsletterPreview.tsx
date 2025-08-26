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
          
          <div className="prose prose-slate max-w-none">
            <div 
              className="min-h-[300px] p-4 border rounded-md focus-within:ring-2 focus-within:ring-primary" 
              contentEditable
              dangerouslySetInnerHTML={{ __html: editContent || "Start writing your newsletter content..." }}
              onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
              style={{ minHeight: "300px" }}
            />
          </div>
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

        {/* Newsletter Content */}
        <div className="prose prose-slate max-w-none">
          <div 
            className="whitespace-pre-wrap text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content || "No content available. Click edit to add newsletter content." }}
          />
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