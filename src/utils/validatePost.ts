// src/utils/validatePost.ts
import type { Platform, PublishNowInput, ValidationResult } from "@/types/publish";

export function validatePostForPlatform(
  platform: Platform,
  input: PublishNowInput
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (platform === "instagram") {
    // Instagram validation
    if (!input.mediaUrl) {
      errors.push("Instagram posts require an image");
    }
    
    if (input.caption && input.caption.length > 2200) {
      errors.push("Instagram captions cannot exceed 2,200 characters");
    }
    
    if (!input.caption || input.caption.trim().length === 0) {
      if (!input.mediaUrl) {
        errors.push("Instagram posts need either a caption or image");
      } else {
        warnings.push("Consider adding a caption to improve engagement");
      }
    }
    
    // Aspect ratio hint (warning only)
    if (input.mediaUrl) {
      warnings.push("Ensure image aspect ratio is between 1.91:1 (landscape) and 4:5 (portrait) for best display");
    }
  } else if (platform === "facebook") {
    // Facebook validation
    if (input.caption && input.caption.length > 63206) {
      errors.push("Facebook posts cannot exceed ~63k characters");
    }
    
    if (!input.caption || input.caption.trim().length === 0) {
      if (!input.mediaUrl) {
        errors.push("Facebook posts need either text or an image");
      } else {
        warnings.push("Consider adding a caption to provide context");
      }
    }
  }

  // General validation
  if (!input.accountId) {
    errors.push("Please select an account to publish to");
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors
  };
}