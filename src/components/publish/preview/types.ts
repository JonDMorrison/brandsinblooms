// src/components/publish/preview/types.ts
export type PreviewPlatform = "instagram" | "facebook";
export type PreviewCounts = { likes: number; comments: number };

export type PreviewProps = {
  platform: PreviewPlatform;
  accountName: string;
  avatarUrl?: string;
  caption: string;
  mediaUrl: string;
  scheduledFor?: string | null; // ISO; if present show "Scheduled"
  likeCount?: number;
  commentCount?: number;
  // optional IG-only field in future: firstComment?: string | null;
};