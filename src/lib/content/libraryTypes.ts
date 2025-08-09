export type Channel = 'newsletter'|'instagram'|'facebook'|'video'|'blog';

export type ContentSummary = {
  bundleId: string;
  snapshotId?: string;
  mode: 'event'|'seasonal'|'custom';
  sourceLabel?: string;
  channels: Channel[];
  approvedCount: number;
  totalItems: number;
  thumbnail?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
