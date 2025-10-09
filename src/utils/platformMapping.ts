// src/utils/platformMapping.ts

/**
 * Database Platform Enum Type
 * Matches the `platform_type` enum in the scheduled_posts table:
 * - FB: Facebook posts
 * - IG_FEED: Instagram feed posts
 * - IG_REEL: Instagram reels
 */
export type PlatformEnum = "FB" | "IG_FEED" | "IG_REEL";

/**
 * Frontend Platform Type
 * User-friendly platform identifiers used in the UI
 */
export type Platform = "facebook" | "instagram";

/**
 * Maps frontend platform values to database enum values
 * 
 * @param platform - Frontend platform identifier ("facebook" | "instagram")
 * @returns Database enum value ("FB" | "IG_FEED" | "IG_REEL")
 * 
 * @example
 * mapPlatformToEnum("facebook") // Returns "FB"
 * mapPlatformToEnum("instagram") // Returns "IG_FEED"
 */
export function mapPlatformToEnum(platform: string): PlatformEnum {
  const map: Record<string, PlatformEnum> = {
    'facebook': 'FB',
    'instagram': 'IG_FEED',
    'fb': 'FB',
    'ig_feed': 'IG_FEED',
    'ig_reel': 'IG_REEL'
  };
  
  return map[platform.toLowerCase()] || 'FB';
}

/**
 * Maps database enum values back to frontend platform values
 * 
 * @param enumValue - Database enum value ("FB" | "IG_FEED" | "IG_REEL")
 * @returns Frontend platform identifier ("facebook" | "instagram")
 * 
 * @example
 * mapEnumToPlatform("FB") // Returns "facebook"
 * mapEnumToPlatform("IG_FEED") // Returns "instagram"
 */
export function mapEnumToPlatform(enumValue: PlatformEnum): Platform {
  const map: Record<PlatformEnum, Platform> = {
    'FB': 'facebook',
    'IG_FEED': 'instagram',
    'IG_REEL': 'instagram'
  };
  
  return map[enumValue] || 'facebook';
}

/**
 * Gets a user-friendly display name for a platform
 * 
 * @param platform - Platform identifier (frontend or database enum)
 * @returns Capitalized display name
 * 
 * @example
 * getPlatformDisplayName("facebook") // Returns "Facebook"
 * getPlatformDisplayName("FB") // Returns "Facebook"
 */
export function getPlatformDisplayName(platform: string): string {
  const normalizedPlatform = platform.toLowerCase();
  
  if (normalizedPlatform === 'facebook' || normalizedPlatform === 'fb') {
    return 'Facebook';
  }
  
  if (normalizedPlatform.includes('instagram') || normalizedPlatform.includes('ig')) {
    return 'Instagram';
  }
  
  return platform;
}
