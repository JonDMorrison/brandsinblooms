/**
 * Weekly Theme Validator
 * Ensures all blocks have images and enforces weekly theme content requirements
 */

import { ContentBlock } from "@/types/emailBuilder";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates that all content blocks have images (required for weekly themes)
 */
export const validateAllBlocksHaveImages = (
  blocks: ContentBlock[],
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  blocks.forEach((block, index) => {
    // Skip blocks that don't need images
    if (block.type === "button" || block.type === "divider") {
      return;
    }

    // Check for missing images
    if (!block.imageUrl && !block.backgroundImageUrl) {
      errors.push(
        `Block ${index + 1} ("${block.title || block.headline || "Untitled"}") is missing an image`,
      );
    }

    // Check for text-only blocks (deprecated for weekly themes)
    if (block.type === "text") {
      warnings.push(
        `Block ${index + 1} is using deprecated 'text' type - should be 'image-text' for weekly themes`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validates that no plain text blocks exist (weekly theme requirement)
 */
export const hasNoTextOnlyBlocks = (
  blocks: ContentBlock[],
): ValidationResult => {
  const errors: string[] = [];

  const textBlocks = blocks.filter((block) => block.type === "text");

  if (textBlocks.length > 0) {
    errors.push(
      `Found ${textBlocks.length} plain text blocks - weekly themes require all blocks to have images`,
    );
    textBlocks.forEach((block, idx) => {
      errors.push(
        `  - Block: "${block.title || block.headline || "Untitled"}"`,
      );
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
};

/**
 * Validates that image queries/prompts exist for all image-bearing blocks
 */
export const validateImageQueries = (
  blocks: ContentBlock[],
): ValidationResult => {
  const warnings: string[] = [];

  blocks.forEach((block, index) => {
    if (block.type === "button" || block.type === "divider") return;

    if (!block.imageQuery && !block.imageUrl) {
      warnings.push(
        `Block ${index + 1} has no image query - may fail generation`,
      );
    }
  });

  return {
    isValid: true, // Warnings only, not blocking
    errors: [],
    warnings,
  };
};

/**
 * Auto-converts text blocks to image-text blocks for weekly themes
 * Marks them for image generation
 */
export const convertTextBlocksToImageText = (
  blocks: ContentBlock[],
): ContentBlock[] => {
  return blocks.map((block) => {
    if (block.type === "text") {
      return {
        ...block,
        type: "image-text",
        imageUrl: block.imageUrl || "",
        shouldFetchImage: true,
        isGeneratingImage: true,
        isWeeklyTheme: true,
      };
    }

    return block;
  });
};

/**
 * Comprehensive weekly theme validation
 * Checks all requirements and returns detailed results
 */
export const validateWeeklyThemeContent = (
  blocks: ContentBlock[],
  isWeeklyTheme: boolean = true,
): ValidationResult => {
  if (!isWeeklyTheme) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const imageValidation = validateAllBlocksHaveImages(blocks);
  const textBlockValidation = hasNoTextOnlyBlocks(blocks);
  const queryValidation = validateImageQueries(blocks);
  const layoutValidation = validateImageLeftLayout(blocks);

  return {
    isValid:
      imageValidation.isValid &&
      textBlockValidation.isValid &&
      layoutValidation.isValid,
    errors: [
      ...imageValidation.errors,
      ...textBlockValidation.errors,
      ...layoutValidation.errors,
    ],
    warnings: [
      ...imageValidation.warnings,
      ...textBlockValidation.warnings,
      ...queryValidation.warnings,
      ...layoutValidation.warnings,
    ],
  };
};

/**
 * Enforces seasonal image relevance for weekly themes
 * Checks that image queries/prompts include seasonal context
 */
export const enforceSeasonalImageRelevance = (
  blocks: ContentBlock[],
  theme: string,
  season?: string,
): ValidationResult => {
  const warnings: string[] = [];
  const currentSeason = season || getCurrentSeason();

  blocks.forEach((block, index) => {
    if (block.type === "button" || block.type === "divider") return;

    const query = block.imageQuery || "";
    const hasSeasonalContext =
      query.toLowerCase().includes(currentSeason.toLowerCase()) ||
      query.toLowerCase().includes("garden") ||
      query.toLowerCase().includes("flower") ||
      query.toLowerCase().includes("plant");

    if (!hasSeasonalContext && query) {
      warnings.push(
        `Block ${index + 1} image query may not be seasonally relevant: "${query}"`,
      );
    }
  });

  return {
    isValid: true,
    errors: [],
    warnings,
  };
};

/**
 * Validates that all non-header blocks use image-left layout
 */
export const validateImageLeftLayout = (
  blocks: ContentBlock[],
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const contentBlocks = blocks.filter(
    (block) =>
      block.type !== "header" &&
      block.type !== "button" &&
      block.type !== "divider",
  );

  contentBlocks.forEach((block, index) => {
    if (block.layout !== "image-left") {
      errors.push(
        `Block ${index + 1} (${block.type}) has layout "${block.layout}" instead of required "image-left"`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Get current season based on month
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}
