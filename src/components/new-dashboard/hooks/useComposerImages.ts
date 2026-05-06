import { useState, useEffect } from "react";
import { ImageAttachment } from "@/lib/contentTypes";
import { extractKeywords } from "@/utils/imageKeywords";
import {
  formatFallbackImages,
  getRelevantFallbacks,
} from "@/services/gardenCenterFallbacks";

export const useComposerImages = (selectedDraft: any) => {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [postWithoutImage, setPostWithoutImage] = useState(false);
  const [imagesFetching, setImagesFetching] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const imagesLoading = imagesFetching;

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setImageError(null);

      if (selectedDraft.attachments?.image) {
        const existingImage = selectedDraft.attachments.image;
        setImages([existingImage]);
        setSelectedImageId(existingImage.id);
      } else {
        fetchImagesForDraft();
      }
    } else {
      setImages([]);
      setSelectedImageId(null);
      setImageError(null);
    }
  }, [selectedDraft]);

  const fetchImagesForDraft = async () => {
    if (!selectedDraft?.ai_output) {
      return;
    }

    setImagesFetching(true);
    setImageError(null);

    try {
      const keywords = extractKeywords(
        selectedDraft.ai_output,
        "garden center plants",
      );
      let query = keywords;

      // Smart context addition - avoid duplicates
      const hasGardenContext =
        query.toLowerCase().includes("garden") ||
        query.toLowerCase().includes("plant") ||
        query.toLowerCase().includes("nursery") ||
        query.toLowerCase().includes("flower");

      if (!hasGardenContext) {
        query = `${keywords} garden`;
      }
      const fetchedImages = formatFallbackImages(
        getRelevantFallbacks(query, 6),
        query,
      );
      setImages(fetchedImages);

      if (fetchedImages.length > 0) {
        setSelectedImageId(fetchedImages[0].id);
      } else {
        const fallbackQuery = `${selectedDraft.post_type || "gardening"} garden center plants`;
        const fallbackImages = formatFallbackImages(
          getRelevantFallbacks(fallbackQuery, 6),
          fallbackQuery,
        );

        if (fallbackImages.length > 0) {
          setImages(fallbackImages);
          setSelectedImageId(fallbackImages[0].id);
        } else {
          setImageError("No relevant garden center images found");
        }
      }
    } catch (error) {
      console.error("[COMPOSER] Error fetching images:", error);
      setImageError("Failed to load images");
      setImages([]);
    } finally {
      setImagesFetching(false);
    }
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImageId(imageId);
    setPostWithoutImage(false);
  };

  const handleImageRefresh = async () => {
    if (!selectedDraft?.ai_output) return;
    setImagesFetching(true);
    setImageError(null);

    try {
      const keywords = extractKeywords(
        selectedDraft.ai_output,
        "garden center plants",
      );
      let query = keywords;

      // Smart context addition - avoid duplicates
      const hasGardenContext =
        query.toLowerCase().includes("garden") ||
        query.toLowerCase().includes("plant") ||
        query.toLowerCase().includes("nursery") ||
        query.toLowerCase().includes("flower");

      if (!hasGardenContext) {
        query = `${keywords} garden`;
      }

      const newImages = formatFallbackImages(
        getRelevantFallbacks(query, 6),
        query,
      );
      setImages(newImages);
      setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
    } catch (error) {
      console.error("[COMPOSER] Error refreshing images:", error);
      setImageError("Failed to refresh images");
    } finally {
      setImagesFetching(false);
    }
  };

  const handleImageSearch = async (query: string) => {
    setImagesFetching(true);
    setImageError(null);

    try {
      let enhancedQuery = query;
      const hasGardenContext =
        query.toLowerCase().includes("garden") ||
        query.toLowerCase().includes("plant") ||
        query.toLowerCase().includes("nursery") ||
        query.toLowerCase().includes("flower");

      if (!hasGardenContext) {
        enhancedQuery = `${query} garden`;
      }

      const searchResults = formatFallbackImages(
        getRelevantFallbacks(enhancedQuery, 6),
        enhancedQuery,
      );
      setImages(searchResults);
      setSelectedImageId(searchResults.length > 0 ? searchResults[0].id : null);
    } catch (error) {
      console.error("[COMPOSER] Error searching images:", error);
      setImageError("Failed to search images");
    } finally {
      setImagesFetching(false);
    }
  };

  const getSelectedImage = (): ImageAttachment | null => {
    return images.find((img) => img.id === selectedImageId) || null;
  };

  return {
    images,
    selectedImageId,
    postWithoutImage,
    setPostWithoutImage,
    imagesFetching,
    imageError,
    imagesLoading,
    handleImageSelect,
    handleImageRefresh,
    handleImageSearch,
    getSelectedImage,
  };
};
