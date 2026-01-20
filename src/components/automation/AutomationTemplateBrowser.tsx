import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Layout, Mail, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface SavedTemplate {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  tags: string[] | null;
  layout_json: any;
  usage_count: number | null;
  created_at: string;
}

interface AutomationTemplateBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SavedTemplate, renderedHtml: string) => void;
}

/**
 * AutomationTemplateBrowser - Browse and select saved email templates for automation nodes
 */
export const AutomationTemplateBrowser: React.FC<AutomationTemplateBrowserProps> = ({
  open,
  onClose,
  onSelectTemplate
}) => {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('saved_campaign_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query) ||
      template.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const handleSelectTemplate = async (template: SavedTemplate) => {
    setSelectedTemplate(template);
    setRendering(true);
    
    try {
      // Convert EmailBlocks to simple HTML for automation
      const blocks = template.layout_json as any[];
      const html = renderBlocksToHtml(blocks);
      
      onSelectTemplate(template, html);
      onClose();
    } catch (error) {
      console.error('Error rendering template:', error);
    } finally {
      setRendering(false);
    }
  };

  /**
   * Simple renderer that converts EmailBlock[] to HTML
   * This matches the server-side rendering for consistency
   */
  const renderBlocksToHtml = (blocks: any[]): string => {
    if (!blocks || !Array.isArray(blocks)) return '';

    return blocks.map(block => {
      const headline = block.headline || block.title || '';
      const body = block.body || block.content || '';
      const imageUrl = block.imageUrl || block.backgroundImageUrl || '';
      const ctaText = block.ctaText || block.buttonText || '';
      const ctaUrl = block.ctaUrl || block.buttonUrl || '';

      switch (block.type) {
        case 'header':
        case 'newsletter-header':
          return `
            <div style="background-color: ${block.backgroundColor || '#1f2937'}; padding: 40px 20px; text-align: center;">
              ${imageUrl ? `<div style="background-image: url(${imageUrl}); background-size: cover; background-position: center; padding: 40px 20px;">` : ''}
              <h1 style="color: ${block.textColor || '#ffffff'}; font-size: 28px; margin: 0 0 16px 0;">${headline}</h1>
              ${body ? `<p style="color: ${block.textColor || '#ffffff'}; font-size: 18px; margin: 0; opacity: 0.9;">${body}</p>` : ''}
              ${imageUrl ? '</div>' : ''}
            </div>
          `;

        case 'text':
          return `
            <div style="padding: 20px;">
              ${headline ? `<h2 style="font-size: 22px; margin: 0 0 12px 0;">${headline}</h2>` : ''}
              <p style="font-size: 16px; line-height: 1.6; margin: 0; color: #374151;">${body}</p>
            </div>
          `;

        case 'image':
          return `
            <div style="padding: 20px;">
              ${imageUrl ? `<img src="${imageUrl}" alt="${block.altText || headline}" style="max-width: 100%; height: auto; border-radius: 8px;" />` : ''}
              ${headline ? `<p style="font-size: 14px; color: #6b7280; margin-top: 8px; text-align: center;">${headline}</p>` : ''}
            </div>
          `;

        case 'image-text':
          return `
            <div style="padding: 20px;">
              ${imageUrl ? `<img src="${imageUrl}" alt="${block.altText || headline}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px;" />` : ''}
              ${headline ? `<h2 style="font-size: 22px; margin: 0 0 12px 0;">${headline}</h2>` : ''}
              <p style="font-size: 16px; line-height: 1.6; margin: 0; color: #374151;">${body}</p>
              ${ctaText && ctaUrl ? `
                <a href="${ctaUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px;">${ctaText}</a>
              ` : ''}
            </div>
          `;

        case 'button':
        case 'cta':
          return ctaText && ctaUrl ? `
            <div style="padding: 20px; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">${ctaText}</a>
            </div>
          ` : '';

        case 'divider':
          return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />`;

        default:
          return body ? `<div style="padding: 20px;"><p style="margin: 0;">${body}</p></div>` : '';
      }
    }).join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Select Email Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Template Grid */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2" />
                <p>No templates found</p>
                <p className="text-sm">Save a campaign as a template first</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-1">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    disabled={rendering && selectedTemplate?.id === template.id}
                    className={`
                      text-left p-4 rounded-lg border transition-all
                      hover:border-primary hover:shadow-md
                      ${selectedTemplate?.id === template.id ? 'border-primary bg-primary/5' : 'border-border'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Mail className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(template.created_at), 'MMM d, yyyy')}
                          {template.usage_count ? (
                            <span>• Used {template.usage_count}x</span>
                          ) : null}
                        </div>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {rendering && selectedTemplate?.id === template.id && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preparing template...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
