import React from 'react';
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { CompactImageCarousel } from "@/components/homepage/ready-to-post/CompactImageCarousel";
import { extractBlogMetadata, cleanContentForDisplay } from "@/utils/contentUtils";
import { formatNewsletterContent, addNewsletterSections } from "@/utils/newsletterFormatter";
import { SafeHtml } from "@/components/ui/safe-html";

interface TaskItemContentProps {
  task: any;
  hasContent: boolean;
  cleanContent: string;
  onClick: (task: any) => void;
}

export const TaskItemContent = ({ task, hasContent, cleanContent, onClick }: TaskItemContentProps) => {
  if (!hasContent) return null;

  // Extract blog metadata for enhanced display using normalized data
  const blogMetadata = task.post_type === 'blog' && hasContent ? 
    extractBlogMetadata(cleanContent) : null;

  return (
    <div className="space-y-4">
      {/* Enhanced content display using normalized data */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {task.post_type === 'blog' ? (
          <BlogPostLayout
            title={blogMetadata?.title}
            companyName={task.campaigns?.company_profiles?.business_name}
            content={cleanContent}
            className="bg-white min-h-0"
          />
        ) : task.post_type === 'newsletter' ? (
          <div className="p-4">
            <div className="prose prose-lg max-w-none">
              {(() => {
                const enhancedContent = addNewsletterSections(cleanContent);
                const formattedContent = formatNewsletterContent(enhancedContent);
                return <SafeHtml content={formattedContent} />;
              })()}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {cleanContent.replace(/<[^>]*>/g, '')}
            </div>
          </div>
        )}
      </div>

      {/* Image thumbnails using normalized image prompts */}
      <div>
        <CompactImageCarousel 
          task={task}
          campaignTheme={task.campaigns?.theme}
          onShowAll={() => onClick(task)}
        />
      </div>
    </div>
  );
};
