export type Channel = 'newsletter'|'instagram'|'facebook'|'video'|'blog';

export type ContentSummary = {
  bundleId: string;
  snapshotId?: string;
  mode: 'event'|'seasonal'|'custom'|'holiday';
  sourceLabel?: string;
  channels: Channel[];
  approvedCount: number;
  totalItems: number;
  thumbnail?: string;
  featuredImage?: string;
  recommendedImages?: { url?: string; thumb_url?: string; download_url?: string; image_url?: string }[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
