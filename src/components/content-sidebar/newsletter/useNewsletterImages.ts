import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractImageSummary } from "@/utils/imageContentSummary";

interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface UnstructuredSection {
  title: string;
  content: string;
  image_prompt: string;
  alt_text: string;
  id: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

// Generate smart search query for a newsletter block or section
const generateSmartSearchQuery = (
  item: NewsletterBlock | UnstructuredSection,
  campaignTheme?: string,
): string => {
  let content = "";

  if ("body" in item) {
    // NewsletterBlock
    content = `${item.title} ${item.body}`;
  } else {
    // UnstructuredSection
    content = `${item.title} ${item.content}`;
  }

  // Use extractImageSummary to get smart keywords
  const smartKeywords = extractImageSummary(content);

  // Add campaign context if available
  const searchQuery = campaignTheme
    ? `${smartKeywords} ${campaignTheme} garden center`
    : `${smartKeywords} garden center`;

  return searchQuery;
};

export const useNewsletterImages = (
  blocks: NewsletterBlock[],
  isPlaceholderContent: boolean,
  contentTaskId?: string,
  campaignTheme?: string,
  unstructuredSections?: UnstructuredSection[],
  featuredImagePrompt?: string,
) => {
  const [images, setImages] = useState<Record<string, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [featuredImage, setFeaturedImage] = useState<ImageData | null>(null);

  // Use ref to track fetch status and prevent multiple fetches
  const fetchStatusRef = useRef<{
    isInProgress: boolean;
    lastFetchKey: string;
  }>({
    isInProgress: false,
    lastFetchKey: "",
  });

  // Memoize the content key to prevent unnecessary re-renders
  const contentKey = useMemo(() => {
    const blocksKey = blocks
      .map((b) => `${b.title}-${b.body}`.slice(0, 100))
      .join("|");
    const sectionsKey =
      unstructuredSections
        ?.map((s) => `${s.title}-${s.content}`.slice(0, 100))
        .join("|") || "";
    return `${blocksKey}${sectionsKey}`;
  }, [blocks, unstructuredSections]);

  useEffect(() => {
    if (isPlaceholderContent) {
      return;
    }

    // Check if we have content to process
    const hasStructuredContent = blocks.length > 0;
    const hasUnstructuredContent =
      unstructuredSections && unstructuredSections.length > 0;

    if (!hasStructuredContent && !hasUnstructuredContent) {
      return;
    }

    // Check if we're already fetching or have already fetched this content
    if (fetchStatusRef.current.isInProgress) {
      return;
    }

    if (fetchStatusRef.current.lastFetchKey === contentKey) {
      return;
    }

    // Mark fetch as in progress and update the last fetch key
    fetchStatusRef.current.isInProgress = true;
    fetchStatusRef.current.lastFetchKey = contentKey;

    setLoadingImages(true);
    setImageErrors({});

    const fetchImages = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.error("[NEWSLETTER] No authenticated user");
          return;
        }

        const imageRequests: any[] = [];

        // Prepare featured image request
        if (featuredImagePrompt) {
          imageRequests.push({
            key: "featured",
            contentContext: featuredImagePrompt,
            contentTitle: "Featured Image",
            isFeatured: true,
          });
        }

        // Prepare structured block requests
        if (hasStructuredContent) {
          const blocksWithContent = blocks.filter((b) => b.title || b.body);
          blocksWithContent.forEach((block, arrayIndex) => {
            const originalIndex = blocks.findIndex(
              (b) => b.title === block.title && b.body === block.body,
            );
            imageRequests.push({
              key: `block-${originalIndex}`,
              contentContext: `${block.title} ${block.body}`,
              contentTitle: block.title,
              index: originalIndex,
            });
          });
        }

        // Prepare unstructured section requests
        if (hasUnstructuredContent) {
          unstructuredSections.forEach((section) => {
            imageRequests.push({
              key: section.id,
              contentContext: `${section.title} ${section.content}`,
              contentTitle: section.title,
              sectionId: section.id,
            });
          });
        }
        // Generate all images in parallel using Lovable AI
        const imagePromises = imageRequests.map(async (request) => {
          try {
            const { data, error } = await supabase.functions.invoke(
              "generate-ai-image",
              {
                body: {
                  contentContext: request.contentContext,
                  contentTitle: request.contentTitle,
                  channel: "newsletter",
                  uploadToStorage: true,
                  userId: user.id,
                },
              },
            );

            if (error) throw error;

            return {
              ...request,
              image: {
                url: data.imageUrl,
                alt: data.metadata?.prompt || request.contentTitle,
                photographer: "AI Generated",
              },
            };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${request.key}:`,
              error,
            );
            return {
              ...request,
              error: error.message,
            };
          }
        });

        // Wait for all images
        const results = await Promise.allSettled(imagePromises);

        // Process results
        const imageMap: Record<string, ImageData> = {};
        const newErrors: Record<string, string> = {};
        let newFeaturedImage: ImageData | null = null;

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            const data = result.value;

            if (data.image) {
              if (data.isFeatured) {
                newFeaturedImage = data.image;
              } else if (data.index !== undefined) {
                imageMap[data.index] = data.image;
              } else if (data.sectionId) {
                imageMap[data.sectionId] = data.image;
              }
            } else if (data.error) {
              newErrors[data.key] = data.error;
            }
          }
        });
        setImages(imageMap);
        setImageErrors(newErrors);

        if (newFeaturedImage) {
          setFeaturedImage(newFeaturedImage);
        }

        // Store images in content task for later CRM conversion
        if (
          contentTaskId &&
          (Object.keys(imageMap).length > 0 || newFeaturedImage)
        ) {
          try {
            const newsletterImages = {
              ...imageMap,
              ...(newFeaturedImage && { featured: newFeaturedImage }),
            };
            await supabase
              .from("content_tasks")
              .update({
                attachments: JSON.parse(
                  JSON.stringify({
                    newsletter_images: newsletterImages,
                  }),
                ),
              })
              .eq("id", contentTaskId);
          } catch (storeError) {}
        }
      } catch (error) {
        console.error("[NEWSLETTER] Error in Promise.all:", error);
      } finally {
        setLoadingImages(false);
        fetchStatusRef.current.isInProgress = false;
      }
    };

    fetchImages();
  }, [
    contentKey,
    isPlaceholderContent,
    contentTaskId,
    campaignTheme,
    featuredImagePrompt,
  ]);

  return {
    images,
    featuredImage,
    loadingImages,
    imageErrors,
  };
};
