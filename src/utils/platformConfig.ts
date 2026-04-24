import {
  Facebook,
  Globe2,
  Instagram,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type PlatformKey = "facebook" | "instagram" | "google_my_business";
export type PlatformIconName = "Facebook" | "Instagram" | "MapPin" | "Globe2";

export interface PlatformConfig {
  label: string;
  description: string;
  icon: PlatformIconName;
  color: string;
}

export interface ResolvedPlatformConfig {
  key: string;
  label: string;
  description: string;
  iconName: PlatformIconName;
  icon: LucideIcon;
  color: string;
}

const PLATFORM_ICON_MAP: Record<PlatformIconName, LucideIcon> = {
  Facebook,
  Instagram,
  MapPin,
  Globe2,
};

export const PLATFORM_ORDER: PlatformKey[] = [
  "facebook",
  "instagram",
  "google_my_business",
];

export const PLATFORM_CONFIG: Record<PlatformKey, PlatformConfig> = {
  facebook: {
    label: "Facebook",
    description: "Track post performance, reach, and engagement trends.",
    icon: "Facebook",
    color: "#4267B2",
  },
  instagram: {
    label: "Instagram",
    description: "Monitor audience growth, content traction, and reach.",
    icon: "Instagram",
    color: "#C13584",
  },
  google_my_business: {
    label: "Google Business Profile",
    description:
      "Track local visibility signals, calls, and direction requests.",
    icon: "MapPin",
    color: "#34A853",
  },
};

const FALLBACK_PLATFORM_CONFIG: Omit<ResolvedPlatformConfig, "key" | "label"> =
  {
    description:
      "Connect and monitor this platform from your social workspace.",
    iconName: "Globe2",
    icon: Globe2,
    color: "#7A8794",
  };

const toTitleCase = (value: string) =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const resolvePlatformKey = (platform: string): PlatformKey | null => {
  const normalized = platform.trim().toLowerCase();

  switch (normalized) {
    case "facebook":
      return "facebook";
    case "instagram":
      return "instagram";
    case "google_business_profile":
    case "google_my_business":
      return "google_my_business";
    default:
      return null;
  }
};

export const getPlatformConfig = (platform: string): ResolvedPlatformConfig => {
  const resolvedKey = resolvePlatformKey(platform);

  if (resolvedKey) {
    const config = PLATFORM_CONFIG[resolvedKey];

    return {
      key: resolvedKey,
      label: config.label,
      description: config.description,
      iconName: config.icon,
      icon: PLATFORM_ICON_MAP[config.icon],
      color: config.color,
    };
  }

  return {
    key: platform,
    label: toTitleCase(platform),
    ...FALLBACK_PLATFORM_CONFIG,
  };
};

export const resolvePlatformIcon = (iconName: PlatformIconName) =>
  PLATFORM_ICON_MAP[iconName];
