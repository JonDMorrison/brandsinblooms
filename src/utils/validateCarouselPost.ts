import type { Platform, PublishNowInput, ValidationResult } from '@/types/publish';

export function validateCarouselPost(
  platform: Platform,
  input: PublishNowInput
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // If not a carousel, use regular validation
  if (!input.isCarousel || !input.mediaUrls || input.mediaUrls.length === 0) {
    return { ok: true, warnings, errors };
  }

  const imageCount = input.mediaUrls.length;

  if (platform === "instagram") {
    // Instagram carousel validation
    if (imageCount < 2) {
      errors.push("Instagram carousels require at least 2 images");
    }
    if (imageCount > 10) {
      errors.push("Instagram carousels cannot exceed 10 images");
    }
    
    // Check caption length
    if (input.caption && input.caption.length > 2200) {
      errors.push("Instagram captions cannot exceed 2,200 characters");
    }
    
    // Warn about aspect ratio requirement
    if (imageCount >= 2) {
      warnings.push("Instagram requires all carousel images to have the same aspect ratio (e.g., all 1:1 or all 4:5)");
    }
    
    // Check file size (Instagram limit is 8MB per image)
    warnings.push("Ensure each image is under 8MB");
    
  } else if (platform === "facebook") {
    // Facebook carousel validation
    if (imageCount < 2) {
      errors.push("Facebook carousels require at least 2 images");
    }
    if (imageCount > 10) {
      errors.push("Facebook carousels cannot exceed 10 images");
    }
    
    // Check caption length
    if (input.caption && input.caption.length > 63206) {
      errors.push("Facebook posts cannot exceed ~63k characters");
    }
    
    // Facebook allows mixed aspect ratios
    if (imageCount >= 2) {
      warnings.push("Facebook allows mixed aspect ratios in carousels");
    }
    
    // Check file size (Facebook limit is 4MB per image)
    warnings.push("Ensure each image is under 4MB");
  }

  // General validation
  if (!input.accountId) {
    errors.push("Please select an account to publish to");
  }

  if (!input.caption || input.caption.trim().length === 0) {
    warnings.push("Consider adding a caption to provide context for your carousel");
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors
  };
}
