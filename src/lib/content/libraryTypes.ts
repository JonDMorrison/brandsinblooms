export type Channel =
  | "newsletter"
  | "instagram"
  | "facebook"
  | "video"
  | "blog";

export type LibraryChannelFilter = Channel | "carousel";

export type LibraryMode = "event" | "seasonal" | "custom" | "holiday";

export type LibrarySort = "newest" | "oldest";

export type ContentSummary = {
  bundleId: string;
  snapshotId?: string;
  mode: LibraryMode;
  title?: string;
  sourceLabel?: string;
  channels: Channel[];
  hasMixedCarousel?: boolean;
  approvedCount: number;
  totalItems: number;
  thumbnail?: string;
  featuredImage?: string;
  recommendedImages?: {
    url?: string;
    thumb_url?: string;
    download_url?: string;
    image_url?: string;
  }[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
