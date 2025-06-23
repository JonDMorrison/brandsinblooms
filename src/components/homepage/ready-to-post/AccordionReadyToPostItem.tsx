
import React from "react";
import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Eye, Image } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { PostTypeAvatar } from "@/components/ui/post-type-avatar";
import { MetaBadges } from "@/components/ui/meta-badges";
import { useTaskImages } from "@/hooks/useTaskImages";
import { handleCopy } from "@/components/content/ContentViewerUtils";
import { CompactImageCarousel } from "./CompactImageCarousel";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { MagazineNewsletterDisplay } from "@/components/content-sidebar/MagazineNewsletterDisplay";
import { cleanContentForDisplay, extractBlogMetadata, getStatusConfig, truncateText } from "@/utils/contentUtils";

interface AccordionReadyToPostItemProps {
  task: any;
  onViewFull: (task: any) => void;
  onTaskUpdate?: () => void;
  isFirst?: boolean;
}

export const AccordionReadyToPostItem = ({ 
  task, 
  onViewFull, 
  onTaskUpdate, 
  isFirst = false 
}: AccordionReadyToPostItemProps) => {
  const { images, imageCount } = useTaskImages(task?.id);

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

  // Get word count estimate
  const wordCount = hasContent ? task.ai_output.split(/\s+/).length : 0;

  // Prepare badges (max 2 visible)
  const badges = [];
  if (task.status === 'ready' || task.status === 'approved' || task.status === 'posted') {
    badges.push({ label: 'Ready to post', variant: 'success' });
  }
  if (isStructuredNewsletter) {
    badges.push({ label: 'Structured', variant: 'structured' });
  }

  const timeAgo = formatDistanceToNowStrict(new Date(task.created_at), { addSuffix: true });

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
    // For now, just show a toast - actual publishing integration would go here
    toast.info('Publishing integration coming soon');
  };

  return (
    <Disclosure as="div" className="w-full accordion-row">
      {({ open }) => (
        <>
          <Disclosure.Button className={`
            relative flex items-center w-full py-3 px-4 
            hover:bg-slate-50/70 dark:hover:bg-slate-800/50
            transition-colors duration-200
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500/60 rounded-md
            ${!isFirst ? 'before:border-t before:border-slate-100 dark:before:border-slate-700 before:absolute before:inset-x-0 before:top-0' : ''}
          `}>
            {/* Post Type Avatar */}
            <div className="flex-shrink-0 mr-3">
              <PostTypeAvatar type={task.post_type} />
            </div>
            
            {/* Title + Preview */}
            <div className="flex-1 min-w-0 text-left md:w-[45%]">
              <div className="flex flex-col">
                <span className="font-medium text-slate-900 dark:text-slate-100 capitalize mb-0.5">
                  {task.post_type}
                  {blogMetadata?.title && (
                    <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-400">
                      {blogMetadata.title}
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {previewText}
                </span>
              </div>
            </div>
            
            {/* Meta Cluster */}
            <MetaBadges 
              badges={badges}
              wordCount={wordCount}
              timeAgo={timeAgo}
              className="mr-3"
            />
            
            {/* Mobile badges (below title) - only show when needed */}
            <div className="md:hidden absolute left-16 top-14">
              <div className="flex items-center gap-1.5">
                {badges.slice(0, 2).map((badge, index) => (
                  <StatusBadge key={index} variant={badge.variant as any}>
                    {badge.label}
                  </StatusBadge>
                ))}
                {badges.length > 2 && (
                  <span className="text-xs text-slate-400">+{badges.length - 2}</span>
                )}
              </div>
            </div>
            
            {/* Chevron */}
            <ChevronDownIcon 
              className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`} 
            />
          </Disclosure.Button>

          <Disclosure.Panel className="accordion-content transition-all duration-300 ease-in-out overflow-hidden">
            <div className={`mx-4 mb-4 rounded-xl border border-garden-green/30 bg-gradient-to-t from-[#F9FFFA] to-white dark:from-gray-800 dark:to-gray-900 shadow-sm px-5 py-4 ${open ? 'accordion-row--open' : ''}`}>
              {/* Header with badges and meta */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 capitalize mb-2">
                    {task.post_type}
                    {blogMetadata?.title && (
                      <span className="ml-2 text-base font-normal text-slate-600 dark:text-slate-400">
                        {blogMetadata.title}
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {badges.map((badge, index) => (
                      <StatusBadge key={index} variant={badge.variant as any}>
                        {badge.label}
                      </StatusBadge>
                    ))}
                    {imageCount > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Image className="w-3 h-3" />
                        <span>{imageCount}</span>
                      </div>
                    )}
                    {blogMetadata?.readingTime && (
                      <span className="text-xs text-gray-500">
                        {blogMetadata.readingTime} min read
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 dark:text-gray-500">
                  <div>{wordCount > 0 ? `${wordCount} words` : '—'}</div>
                  <div>{timeAgo}</div>
                </div>
              </div>
              
              {/* Enhanced content display */}
              {hasContent && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
                  {task.post_type === 'blog' ? (
                    <BlogPostLayout
                      title={blogMetadata?.title}
                      companyName={task.campaigns?.company_profiles?.business_name}
                      content={cleanContent}
                      className="bg-white dark:bg-gray-800 min-h-0"
                    />
                  ) : task.post_type === 'newsletter' ? (
                    <div className="p-6">
                      <MagazineNewsletterDisplay content={task.ai_output} />
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {cleanContent.replace(/<[^>]*>/g, '')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image thumbnails */}
              {hasContent && (
                <div className="mb-4">
                  <CompactImageCarousel 
                    task={task}
                    campaignTheme={task.campaigns?.theme}
                    onShowAll={() => onViewFull(task)}
                  />
                </div>
              )}

              {/* Actions */}
              <TooltipProvider>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleViewFull}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Full
                  </Button>

                  {hasContent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyContent}
                      className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  )}

                  {task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handlePublish}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Publish
                    </Button>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
};
