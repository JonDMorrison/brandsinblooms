import React, { useEffect, useState } from "react";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { CompactImageCarousel } from "@/components/homepage/ready-to-post/CompactImageCarousel";
import {
  extractBlogMetadata,
  cleanContentForDisplay,
} from "@/utils/contentUtils";
import { convertMarkdownToHtml } from "@/utils/markdownUtils";
import { MagazineContentDisplay } from "@/components/content/task-item/MagazineContentDisplay";
import { ImageAssetManager } from "@/lib/imageAssetManager";
import { useAuth } from "@/contexts/AuthContext";
import { AIImageLoadingOverlay } from "@/components/ui-legacy/AIImageLoadingOverlay";
import { useRealtimeImageUpdates } from "@/hooks/useRealtimeImageUpdates";

interface TaskCampaignCompanyProfile {
  business_name?: string | null;
}

interface TaskCampaign {
  title?: string | null;
  company_profiles?: TaskCampaignCompanyProfile | null;
}

interface TaskItemImageMetadata {
  source?: string;
  unsplash_id?: string;
  thumb?: string;
  alt_text?: string;
  photographer?: string;
}

interface TaskItemContentTask {
  id: string;
  post_type: string;
  image_url?: string | null;
  image_generation_status?: string | null;
  image_idea?: string | null;
  campaigns?: TaskCampaign | null;
}

interface TaskItemContentProps {
  task: TaskItemContentTask;
  hasContent: boolean;
  cleanContent: string;
  onClick: (task: TaskItemContentTask) => void;
}

export const TaskItemContent = ({
  task,
  hasContent,
  cleanContent,
  onClick,
}: TaskItemContentProps) => {
  const { user } = useAuth();
  const imageUpdates = useRealtimeImageUpdates(task.id);
  const [displayImageUrl, setDisplayImageUrl] = useState(task.image_url);

  // Update display image when real-time update arrives
  useEffect(() => {
    if (imageUpdates.imageUrl) {
      setDisplayImageUrl(imageUpdates.imageUrl);
    }
  }, [imageUpdates.imageUrl]);

  if (!hasContent) return null;

  // Extract blog metadata for enhanced display using normalized data
  const blogMetadata =
    task.post_type === "blog" && hasContent
      ? extractBlogMetadata(cleanContent)
      : null;

  const handleImageSelect = async (
    imageUrl: string,
    metadata?: TaskItemImageMetadata,
  ) => {
    if (!user || !task.id) return;

    try {
      // Update the content task with the selected image
      await ImageAssetManager.updateContentTaskImage(
        task.id,
        imageUrl,
        metadata?.source || "unsplash",
        metadata,
      );

      // If it's an Unsplash image, create an asset record
      if (metadata?.source === "unsplash" && metadata?.unsplash_id) {
        await ImageAssetManager.createUnsplashAsset(user.id, task.id, {
          url: imageUrl,
          thumb: metadata.thumb || imageUrl,
          alt: metadata.alt_text || "",
          photographer: metadata.photographer,
          unsplash_id: metadata.unsplash_id,
        });
      }

      // Refresh the parent component if needed
      // This would typically trigger a re-fetch of the task data
    } catch (error) {
      console.error("Error updating task image:", error);
    }
  };

  const isGeneratingImage =
    imageUpdates.status === "generating" ||
    (task.image_generation_status === "generating" && !displayImageUrl);

  return (
    <div className="space-y-4">
      {/* Enhanced content display using normalized data */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
        {isGeneratingImage && (
          <AIImageLoadingOverlay
            message="AI is creating your garden image..."
            className="absolute inset-0"
          />
        )}

        {task.post_type === "blog" ? (
          <BlogPostLayout
            title={blogMetadata?.title}
            companyName={task.campaigns?.company_profiles?.business_name}
            content={convertMarkdownToHtml(cleanContent)}
            className="bg-white min-h-0"
            showMediaSelector={true}
            selectedImageUrl={displayImageUrl}
            contentContext={task.image_idea || cleanContent}
            onImageSelect={handleImageSelect}
          />
        ) : task.post_type === "newsletter" ? (
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
              {cleanContent.replace(/<[^>]*>/g, "")}
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
