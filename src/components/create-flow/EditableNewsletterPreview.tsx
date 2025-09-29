import React, { useState, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NewsletterContentBlock } from '@/components/content-sidebar/newsletter/NewsletterContentBlock';
import { useNewsletterImages } from '@/components/content-sidebar/newsletter/useNewsletterImages';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { Edit, Save, X, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

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

  // Rich text editor configuration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: editContent || "Start writing your newsletter content...",
    onUpdate: ({ editor }) => {
      setEditContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none',
      },
    },
  });

  // Update editor content when editContent changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && isEditing) {
      const currentContent = editor.getHTML();
      if (currentContent !== editContent) {
        console.log('🔄 SYNC: Updating editor with editContent =', editContent);
        editor.commands.setContent(editContent || "Start writing your newsletter content...");
      }
    }
  }, [editContent, editor, isEditing]);

  // Update editContent when the main content prop changes (external updates)
  useEffect(() => {
    if (!isEditing) {
      setEditContent(content);
      console.log('🔄 SYNC: Updated editContent from props =', content);
    }
  }, [content, isEditing]);

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
    // Set editor content when starting to edit
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || "Start writing your newsletter content...");
    }
  };

  const handleSave = () => {
    // Get the latest content directly from the editor
    const latestContent = editor ? editor.getHTML() : editContent;
    console.log('🔥 SAVE: Editor content =', latestContent);
    console.log('🔥 SAVE: State content =', editContent);
    
    // Update the content through onChange prop
    onChange(latestContent);
    setIsEditing(false);
    onSave?.();
    // Note: selectedImages will be preserved even after content changes
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
    // Reset editor content when canceling
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || "");
    }
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
          
          {/* Rich Text Editor Toolbar */}
          {editor && (
            <div className="border border-border rounded-md">
              <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50">
                <Button
                  variant={editor.isActive('bold') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('italic') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('underline') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Rich Text Editor Content */}
              <div className="min-h-[300px] p-4 focus-within:ring-2 focus-within:ring-primary">
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
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
            dangerouslySetInnerHTML={{
              __html: (() => {
                if (!content) return "No content available. Click edit to add newsletter content.";
                
                // Check if content is already HTML (contains HTML tags)
                const isHTML = /<[^>]*>/g.test(content);
                
                if (isHTML) {
                  // Content is already HTML, render it directly
                  return content;
                }
                
                // Parse YAML-like content to extract readable text and convert to HTML
                let cleanContent = content;
                
                // Extract newsletter title
                const titleMatch = cleanContent.match(/# (.+)/);
                const title = titleMatch ? titleMatch[1].replace(/Newsletter$/, '').trim() : '';
                
                // Extract blocks content
                const blockPattern = /title: "([^"]+)"\s*body: "([^"]+)"/g;
                const blocks = [];
                let match;
                
                while ((match = blockPattern.exec(cleanContent)) !== null) {
                  blocks.push({
                    title: match[1],
                    body: match[2]
                  });
                }
                
                // If we have structured content, convert to HTML
                if (blocks.length > 0) {
                  let html = '';
                  if (title) {
                    html += `<h1 class="text-3xl font-bold mb-6">${title}</h1>`;
                  }
                  blocks.forEach(block => {
                    html += `
                      <div class="mb-8">
                        <h2 class="text-xl font-semibold mb-3">${block.title}</h2>
                        <p class="text-slate-700 leading-relaxed">${block.body}</p>
                      </div>
                    `;
                  });
                  return html;
                }
                
                // Fallback: clean up YAML syntax and convert to HTML
                const cleaned = cleanContent
                  .replace(/```yaml\s*/, '')
                  .replace(/```\s*$/, '')
                  .replace(/newsletter_md:\s*\|/, '')
                  .replace(/^[\s]*blocks$/, '')
                  .replace(/^[\s]*meta$/, '')
                  .replace(/title:\s*"([^"]+)"/g, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
                  .replace(/body:\s*"([^"]+)"/g, '<p class="text-slate-700 leading-relaxed mb-4">$1</p>')
                  .replace(/cta:\s*"[^"]*"/g, '')
                  .replace(/link:\s*"[^"]*"/g, '')
                  .replace(/reading_time:\s*"[^"]*"/g, '')
                  .replace(/theme:\s*"[^"]*"/g, '')
                  .replace(/week_focus:\s*"[^"]*"/g, '')
                  .replace(/\n\s*\n\s*\n/g, '<br><br>')
                  .replace(/\n/g, '<br>')
                  .trim();
                
                return cleaned || "No content available. Click edit to add newsletter content.";
              })()
            }}
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