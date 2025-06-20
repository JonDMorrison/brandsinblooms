
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, ExternalLink, Eye, Image } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlatformChip } from "@/components/ui/platform-chip";
import { stripMarkdown, truncateText, getStatusConfig } from "@/utils/contentUtils";
import { useTaskImages } from "@/hooks/useTaskImages";
import { handleCopy } from "@/components/content/ContentViewerUtils";
import { CompactImageCarousel } from "./CompactImageCarousel";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { StructuredNewsletterDisplay } from "@/components/content-sidebar/StructuredNewsletterDisplay";
import { cleanContentForDisplay, extractBlogMetadata } from "@/utils/contentUtils";

interface AccordionReadyToPostItemProps {
  task: any;
  onViewFull: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const AccordionReadyToPostItem = ({ task, onViewFull, onTaskUpdate }: AccordionReadyToPostItemProps) => {
  const { images, imageCount } = useTaskImages(task?.id);
  const [publishing, setPublishing] = useState(false);

  const statusConfig = getStatusConfig(task.status);
  const hasContent = task.ai_output && task.ai_output.trim() !== '';
  
  // Check if this is a structured newsletter
  const isStructuredNewsletter = task.post_type === 'newsletter' && hasContent && task.ai_output.includes('newsletter_md:');
  
  let cleanContent = '';
  let previewText = '';
  
  if (hasContent) {
    if (isStructuredNewsletter) {
      // For structured newsletters, extract the markdown content for preview
      const yamlMatch = task.ai_output.match(/newsletter_md:\s*\|\s*\n([\s\S]*?)(?=\nblocks:|$)/);
      if (yamlMatch) {
        cleanContent = yamlMatch[1].trim();
        previewText = truncateText(cleanContent.replace(/[#*]/g, '').replace(/\s+/g, ' ').trim(), 110, '…');
      } else {
        previewText = 'Structured newsletter content available...';
      }
    } else {
      // Process content through the appropriate formatter
      cleanContent = cleanContentForDisplay(task.ai_output, task.post_type);
      previewText = truncateText(cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(), 110, '…');
    }
  } else {
    previewText = 'Content will be generated soon...';
  }
  
  // Extract blog metadata for enhanced display
  const blogMetadata = task.post_type === 'blog' && hasContent ? extractBlogMetadata(cleanContent) : null;

  const handleViewFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewFull(task);
  };

  const handleCopyContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasContent) {
      // Copy the clean text without HTML tags for clipboard
      const textToCopy = cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      handleCopy(textToCopy);
      toast.success('Content copied to clipboard');
    }
  };

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPublishing(true);
    
    try {
      // For now, just show a toast - actual publishing integration would go here
      toast.info('Publishing integration coming soon');
    } catch (error) {
      console.error('Error publishing:', error);
      toast.error('Failed to publish content');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={task.id} className="border-gray-200 rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex flex-col w-full space-y-2">
            {/* First row - Platform chip and status */}
            <div className="flex items-center justify-between w-full">
              {/* Left cluster - Platform chip with enhanced title */}
              <div className="flex items-center gap-3">
                <PlatformChip postType={task.post_type} />
                {task.post_type === 'blog' && blogMetadata?.title && (
                  <span className="text-sm font-medium text-slate-700 truncate max-w-xs">
                    {blogMetadata.title}
                  </span>
                )}
                {isStructuredNewsletter && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Structured
                  </span>
                )}
              </div>

              {/* Right cluster - Status and metadata */}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" title="Ready to post" />
                {blogMetadata?.readingTime && (
                  <span className="text-xs text-gray-500">
                    {blogMetadata.readingTime} min read
                  </span>
                )}
                {imageCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Image className="w-3 h-3" />
                    <span>{imageCount}</span>
                  </div>
                )}
                {task.scheduled_date && (
                  <span className="text-xs text-gray-400">
                    {new Date(task.scheduled_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Second row - Preview text */}
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-gray-600 italic flex-1 text-left">
                {previewText}
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Enhanced content display */}
            {hasContent && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {task.post_type === 'blog' ? (
                  <BlogPostLayout
                    title={blogMetadata?.title}
                    companyName={task.campaigns?.company_profiles?.business_name}
                    content={cleanContent}
                    className="bg-white min-h-0"
                  />
                ) : isStructuredNewsletter ? (
                  <div className="p-6">
                    <StructuredNewsletterDisplay content={task.ai_output} />
                  </div>
                ) : (task.post_type === 'newsletter') ? (
                  <div className="p-6">
                    <div 
                      className="prose prose-lg prose-headings:font-display prose-a:text-primary prose-strong:text-slate-900 prose-li:marker:text-primary max-w-none"
                      dangerouslySetInnerHTML={{ __html: cleanContent }}
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {cleanContent.replace(/<[^>]*>/g, '')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image thumbnails */}
            {hasContent && (
              <div>
                <CompactImageCarousel 
                  task={task}
                  campaignTheme={task.campaigns?.theme}
                  onShowAll={() => onViewFull(task)}
                />
              </div>
            )}

            {/* Action bar - focused on publishing actions */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleViewFull}
                  className="flex-1 min-w-[80px] border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Full
                </Button>

                {hasContent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyContent}
                    className="flex-1 min-w-[80px]"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                )}

                {task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex-1 min-w-[80px] bg-green-600 hover:bg-green-700"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                )}
              </div>
            </TooltipProvider>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
