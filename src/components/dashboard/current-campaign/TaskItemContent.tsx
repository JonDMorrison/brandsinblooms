
import React from 'react';
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { CompactImageCarousel } from "@/components/homepage/ready-to-post/CompactImageCarousel";
import { extractBlogMetadata, cleanContentForDisplay } from "@/utils/contentUtils";
import { convertMarkdownToHtml } from "@/utils/markdownUtils";
import { MagazineContentDisplay } from "@/components/content/task-item/MagazineContentDisplay";
import { ImageAssetManager } from "@/lib/imageAssetManager";
import { useAuth } from "@/contexts/AuthContext";

interface TaskItemContentProps {
  task: any;
  hasContent: boolean;
  cleanContent: string;
  onClick: (task: any) => void;
}

export const TaskItemContent = ({ task, hasContent, cleanContent, onClick }: TaskItemContentProps) => {
  const { user } = useAuth();

  if (!hasContent) return null;

  // Extract blog metadata for enhanced display using normalized data
  const blogMetadata = task.post_type === 'blog' && hasContent ? 
    extractBlogMetadata(cleanContent) : null;

  const handleImageSelect = async (imageUrl: string, metadata?: any) => {
    if (!user || !task.id) return;

    try {
      // Update the content task with the selected image
      await ImageAssetManager.updateContentTaskImage(
        task.id,
        imageUrl,
        metadata?.source || 'unsplash',
        metadata
      );

      // If it's an Unsplash image, create an asset record
      if (metadata?.source === 'unsplash' && metadata?.unsplash_id) {
        await ImageAssetManager.createUnsplashAsset(
          user.id,
          task.id,
          {
            url: imageUrl,
            thumb: metadata.thumb || imageUrl,
            alt: metadata.alt_text || '',
            photographer: metadata.photographer,
            unsplash_id: metadata.unsplash_id
          }
        );
      }

      // Refresh the parent component if needed
      // This would typically trigger a re-fetch of the task data
    } catch (error) {
      console.error('Error updating task image:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Enhanced content display using normalized data */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {task.post_type === 'blog' ? (
          <BlogPostLayout
            title={blogMetadata?.title}
            companyName={task.campaigns?.company_profiles?.business_name}
            content={convertMarkdownToHtml(cleanContent)}
            className="bg-white min-h-0"
            showMediaSelector={true}
            selectedImageUrl={task.image_url}
            contentContext={cleanContent}
            onImageSelect={handleImageSelect}
          />
        ) : task.post_type === 'newsletter' ? (
          <div className="p-0">
            <MagazineContentDisplay
              content={cleanContent}
              postType={task.post_type}
              contentTaskId={task.id}
              campaignTitle={task.campaigns?.title}
              task={task}
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
