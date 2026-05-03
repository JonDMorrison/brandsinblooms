import type { SVGProps } from "react";
import type {
  StudioSocialIconStyle,
  StudioSocialPlatform,
} from "@/types/studioBlocks";

export type SocialIconProps = {
  platform: StudioSocialPlatform;
  size?: number;
  color?: string;
  variant?: StudioSocialIconStyle;
};

export const SOCIAL_PLATFORM_LABELS: Record<StudioSocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  threads: "Threads",
};

export const SOCIAL_PLATFORM_BRAND_COLORS: Record<
  StudioSocialPlatform,
  string
> = {
  facebook: "#1877F2",
  instagram: "#C13584",
  twitter: "#111111",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#111111",
  pinterest: "#E60023",
  threads: "#111111",
};

export const SOCIAL_PLATFORM_ORDER: StudioSocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
];

function Mark({
  platform,
  color,
  ...props
}: SVGProps<SVGSVGElement> & {
  platform: StudioSocialPlatform;
  color: string;
}) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="M13.5 20v-7h2.4l.4-3h-2.8V8.2c0-.9.3-1.5 1.6-1.5h1.4V4.1c-.7-.1-1.4-.1-2.1-.1-2.6 0-4.4 1.6-4.4 4.5V10H7.7v3H10v7h3.5Z"
            fill={color}
          />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="4"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          <circle
            cx="12"
            cy="12"
            r="3.2"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          <circle cx="16.3" cy="7.8" r="1" fill={color} />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="m6.2 5 5 6.7L6 19h2.5l3.9-5.4L16.5 19H20l-5.5-7.3L19.3 5h-2.5l-3.5 4.9L9.7 5H6.2Zm3 1.8 7.2 10.4h-1.2L8 6.8h1.2Z"
            fill={color}
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="M6.5 9.6H10V19H6.5V9.6Zm.2-2.9a1.9 1.9 0 1 1 3.8 0 1.9 1.9 0 0 1-3.8 0ZM12 9.6h3.3v1.3c.5-.8 1.4-1.5 2.9-1.5 2.3 0 3.8 1.5 3.8 4.5V19h-3.5v-4.6c0-1.3-.5-2.1-1.5-2.1-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8V19H12V9.6Z"
            fill={color}
          />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <rect x="4" y="7" width="16" height="10" rx="3" fill={color} />
          <path d="m10.5 9.7 4.7 2.3-4.7 2.3V9.7Z" fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="M15 4c.4 2.3 1.8 3.6 4 3.9v3a6.8 6.8 0 0 1-4-1.2v5.2c0 3-2 5.1-5 5.1-2.7 0-4.7-1.8-4.7-4.4 0-2.7 2.1-4.5 4.8-4.5.4 0 .8 0 1.1.1v3.1c-.3-.1-.7-.2-1.1-.2-1 0-1.8.6-1.8 1.5s.7 1.5 1.7 1.5c1.1 0 1.8-.7 1.8-2V4H15Z"
            fill={color}
          />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="M12 4.2c-4.1 0-6.2 2.7-6.2 5.7 0 1.9 1 3.5 2.5 4.1.3.1.5 0 .6-.3l.3-1.2c.1-.3 0-.4-.2-.7-.5-.6-.8-1.2-.8-2.1 0-1.9 1.4-3.7 3.8-3.7 2.1 0 3.3 1.3 3.3 3.1 0 2.3-1 4.3-2.6 4.3-.9 0-1.5-.7-1.3-1.6.2-1 .7-2 .7-2.7 0-.6-.3-1.1-1-1.1-.8 0-1.4.8-1.4 1.9 0 .7.2 1.1.2 1.1l-1 4.2c-.3 1.2-.2 2.9-.1 4 .7-.9 1.6-2.3 1.9-3.5l.5-1.9c.5.9 1.4 1.4 2.5 1.4 3.3 0 5.5-3 5.5-6.9 0-3-2.5-5.9-6.4-5.9Z"
            fill={color}
          />
        </svg>
      );
    case "threads":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path
            d="M12.2 4C7.8 4 5.3 7 5.3 12s2.5 8 7 8c4 0 6.7-2.3 6.7-5.5 0-2.3-1.3-3.8-3.5-4.4-.4-2-1.7-3.1-3.7-3.1-1.5 0-2.7.7-3.4 2l2 .9c.3-.7.8-1 1.5-1 .9 0 1.5.5 1.7 1.5h-1.3c-2.5 0-4 1.2-4 3.1 0 1.8 1.4 3 3.5 3 2.3 0 3.8-1.3 3.9-3.4 1 .4 1.5 1.1 1.5 2.1 0 1.8-1.8 3-4.5 3-3.1 0-4.8-2.2-4.8-6.1 0-3.9 1.7-6.1 4.8-6.1 2.2 0 3.8 1 4.6 2.9l2-.9C17.6 5.4 15.4 4 12.2 4Zm.2 7.9h1.3v.4c0 1.4-.7 2.3-1.9 2.3-.8 0-1.3-.4-1.3-1.1 0-1 .8-1.6 1.9-1.6Z"
            fill={color}
          />
        </svg>
      );
  }
}

export function SocialIcon({
  platform,
  size = 32,
  color,
  variant = "filled",
}: SocialIconProps) {
  const resolvedColor = color ?? SOCIAL_PLATFORM_BRAND_COLORS[platform];
  const iconSize = Math.max(14, Math.round(size * 0.62));
  const minimal = variant === "minimal";
  const filled = variant === "filled" || variant === "square";
  const radius = variant === "square" ? "6px" : "50%";
  const markColor = filled ? "#ffffff" : resolvedColor;

  if (minimal) {
    return (
      <Mark
        platform={platform}
        color={resolvedColor}
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: filled ? resolvedColor : "transparent",
        border:
          variant === "outlined" ? `1.5px solid ${resolvedColor}` : "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      <Mark
        platform={platform}
        color={markColor}
        width={iconSize}
        height={iconSize}
        style={{ display: "block" }}
      />
    </span>
  );
}
