// src/utils/validatePost.ts
import type {
  Platform,
  PublishNowInput,
  ValidationResult,
} from "@/types/publish";

export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  facebook: 63206,
  instagram: 2200,
};

export type PublishFieldValidation = {
  accountError?: string;
  captionError?: string;
  contentError?: string;
  warnings: string[];
};

export function getPlatformCharacterLimit(platform: Platform): number {
  return PLATFORM_CHARACTER_LIMITS[platform];
}

export function getPlatformContentError(platform: Platform): string {
  return platform === "instagram"
    ? "Instagram posts need a caption or an image"
    : "Facebook posts need text or an image";
}

export function getMissingAccountError(platform: Platform): string {
  return `No ${platform === "instagram" ? "Instagram" : "Facebook"} account connected`;
}

export function getPublishFieldValidation(
  platform: Platform,
  input: Pick<PublishNowInput, "accountId" | "caption" | "mediaUrl">,
): PublishFieldValidation {
  const warnings: string[] = [];
  const caption = input.caption ?? "";
  const trimmedCaption = caption.trim();
  const hasCaption = trimmedCaption.length > 0;
  const hasMedia = Boolean(input.mediaUrl);
  const characterLimit = getPlatformCharacterLimit(platform);
  const charactersOverLimit = Math.max(0, caption.length - characterLimit);

  if (hasMedia && platform === "instagram") {
    warnings.push(
      "Ensure image aspect ratio is between 1.91:1 (landscape) and 4:5 (portrait) for best display",
    );
  }

  return {
    accountError: input.accountId
      ? undefined
      : getMissingAccountError(platform),
    captionError:
      charactersOverLimit > 0
        ? `${charactersOverLimit} characters over the limit`
        : undefined,
    contentError:
      hasCaption || hasMedia ? undefined : getPlatformContentError(platform),
    warnings,
  };
}

export function validatePostForPlatform(
  platform: Platform,
  input: PublishNowInput,
): ValidationResult {
  const fieldValidation = getPublishFieldValidation(platform, input);
  const errors = [
    fieldValidation.accountError,
    fieldValidation.captionError,
    fieldValidation.contentError,
  ].filter((value): value is string => Boolean(value));

  return {
    ok: errors.length === 0,
    warnings: fieldValidation.warnings,
    errors,
  };
}
