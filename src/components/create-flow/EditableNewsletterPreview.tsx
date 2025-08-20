import React, { useState, useMemo } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { convertNewsletterToCRM_Direct } from '@/utils/newsletterToCrmSync';
import { NewsletterContentBlock } from '@/components/content-sidebar/newsletter/NewsletterContentBlock';
import { ImageSelectButton } from '@/components/image';
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

  // Convert newsletter content to blocks for preview
  const newsletterBlocks = useMemo(() => {
    return convertNewsletterToCRM_Direct(content);
  }, [content]);

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleSave = () => {
    onChange(editContent);
    setIsEditing(false);
    onSave?.();
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
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
      {/* Edit button overlay */}
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" onClick={handleStartEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      {/* Newsletter Preview */}
      <div className="p-6">
        {/* Newsletter Header */}
        <div className="mb-8 text-center border-b pb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-600">Your Garden Center Newsletter</p>
        </div>

        {/* Newsletter Blocks */}
        <div className="space-y-12">
          {newsletterBlocks.length > 0 ? (
            newsletterBlocks.map((block, index) => (
              <div key={index} className="border-b border-slate-100 last:border-b-0 pb-12 last:pb-0">
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {/* Content */}
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                      {block.headline || `Section ${index + 1}`}
                    </h3>
                    
                    <div className="prose prose-slate max-w-none">
                      <div 
                        className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: block.body || block.content || 'Content not available' }}
                      />
                    </div>
                    
                    {block.ctaText && (
                      <div className="mt-6">
                        <span className="inline-flex items-center text-primary font-semibold">
                          {block.ctaText} →
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Image */}
                  <div>
                    <div className="aspect-[4/3] bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {block.imageUrl ? (
                        <img 
                          src={block.imageUrl} 
                          alt={block.altText || 'Newsletter image'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-slate-400 text-center">
                          <div className="text-sm font-medium">Newsletter Image</div>
                          <div className="text-xs mt-1">Click edit to add images</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Click edit to add newsletter content</p>
            </div>
          )}
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

      {/* Click to edit hint */}
      <div 
        className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg"
        onClick={handleStartEdit}
      >
        <div className="bg-white rounded-lg px-4 py-2 shadow-lg border">
          <span className="text-sm font-medium">Click to edit newsletter</span>
        </div>
      </div>
    </Card>
  );
};