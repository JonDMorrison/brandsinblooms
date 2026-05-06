import {
  formatFallbackImages,
  getRelevantFallbacks,
} from "@/services/gardenCenterFallbacks";

interface MediaSelectorOptions {
  prompt: string;
  fallback?: string;
  count?: number;
}

interface MediaSelectorResult {
  url: string;
  thumb?: string;
  alt: string;
  photographer?: string;
}

export const mediaSelector = async (
  options: MediaSelectorOptions,
): Promise<MediaSelectorResult> => {
  const { prompt, count = 1 } = options;
  try {
    const suggestions = formatFallbackImages(
      getRelevantFallbacks(prompt, count),
      prompt,
    );

    if (suggestions.length > 0) {
      const selectedImage = suggestions[0];
      return {
        url: selectedImage.download_url,
        thumb: selectedImage.thumb_url,
        alt: selectedImage.alt || prompt,
        photographer: selectedImage.photographer,
      };
    }
    return createGardenFallbackResult(prompt);
  } catch (error) {
    console.error("[MEDIA SELECTOR] Error fetching image:", error);
    return createGardenFallbackResult(prompt);
  }
};

const createGardenFallbackResult = (prompt: string): MediaSelectorResult => {
  const [fallbackImage] = formatFallbackImages(
    getRelevantFallbacks(prompt, 1),
    prompt,
  );

  return {
    url: fallbackImage?.download_url || "",
    thumb: fallbackImage?.thumb_url,
    alt: fallbackImage?.alt || `Beautiful garden plants - ${prompt}`,
    photographer: fallbackImage?.photographer || "BloomSuite Studio",
  };
};

// Sequential batch image fetching for multiple prompts
export const batchMediaSelector = async (
  prompts: string[],
  fallback?: string,
): Promise<MediaSelectorResult[]> => {
  const results: MediaSelectorResult[] = [];

  try {
    // Process images one by one to prevent flashing
    for (let i = 0; i < prompts.length; i++) {
      try {
        const result = await mediaSelector({ prompt: prompts[i] });
        results.push(result);

        // Small delay between images to prevent overwhelming the UI
        if (i < prompts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(
          `[MEDIA SELECTOR] Failed to fetch image for "${prompts[i]}":`,
          error,
        );
        results.push(createGardenFallbackResult(prompts[i]));
      }
    }
    return results;
  } catch (error) {
    console.error("[MEDIA SELECTOR] Sequential batch error:", error);
    // Return garden fallback results for all prompts
    return prompts.map((prompt) => createGardenFallbackResult(prompt));
  }
};
