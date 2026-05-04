export interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (
    imageUrl: string,
    metadata?: AIImageStudioSelectionMetadata,
  ) => void;
  aspectRatioHint?: AIImageStudioAspectRatio;
  browseOnly?: boolean;
  channel?: string;
  contentContext?: string;
  contextLabel?: string;
  defaultTab?: AIImageStudioTab;
  blockId?: string;
  contextType?: string;
}

export interface AIImageStudioDrawerProps {
  open: boolean;
  onClose: () => void;
  onImageSelect: (
    imageUrl: string,
    metadata?: AIImageStudioSelectionMetadata,
  ) => void;
  aspectRatioHint?: AIImageStudioAspectRatio;
  browseOnly?: boolean;
  channel?: string;
  contentContext?: string;
  contextLabel?: string;
  defaultTab?: AIImageStudioTab;
  blockId?: string;
  contextType?: string;
}

export type AIImageStudioTab = "ai" | "my-images" | "unsplash" | "upload";

export interface AIImageStudioSelectionMetadata {
  altText?: string;
  attribution?: string;
  dimensions?: AIImageStudioImageDimensions | null;
  mimeType?: string | null;
  photographer?: string;
  photographerUrl?: string;
  source:
    | "ai-generated"
    | "global_image_gallery"
    | "content_asset"
    | "unsplash"
    | "upload";
  tags?: AIImageStudioImageTag[];
  unsplashId?: string;
}

export interface AIImageStudioOpenOptions {
  aspectRatioHint?: AIImageStudioAspectRatio;
  blockId?: string;
  browseOnly?: boolean;
  channel?: string;
  contentContext?: string;
  contextLabel?: string;
  contextType?: string;
  defaultTab?: AIImageStudioTab;
  onClose?: () => void;
  onSelect: (
    imageUrl: string,
    metadata?: AIImageStudioSelectionMetadata,
  ) => void;
}

export interface AIImageStudioSessionInfo {
  sessionId: string;
  title: string | null;
  contextType: string | null;
  channel: string | null;
  createdAt: string;
}

export type AIImageStudioAspectRatio = "1:1" | "16:9" | "9:16";

export type AIImageStudioStylePreset =
  | "photographic"
  | "illustration"
  | "watercolor"
  | "minimalist"
  | "cinematic";

export type AIImageStudioQuality = "standard" | "hd";

export interface AIImageStudioGenerationConfig {
  aspectRatio: AIImageStudioAspectRatio;
  stylePreset: AIImageStudioStylePreset;
  quality: AIImageStudioQuality;
}

export type AIImageStudioLoadingPhase = "acknowledged" | "thinking";

export type AIImageStudioErrorKind = "api" | "policy" | "timeout" | "cancelled";

export interface AIImageStudioImageDimensions {
  height: number;
  width: number;
}

export interface AIImageStudioImageTag {
  category?: string;
  confidence?: number | null;
  name: string;
}

export interface AIImageStudioImageResult {
  dimensions?: AIImageStudioImageDimensions | null;
  enhancedPrompt?: string | null;
  generationOrder?: number;
  globalImageId?: string;
  id: string;
  imageRecordId?: string;
  imageUrl: string;
  mimeType?: string | null;
  tags?: AIImageStudioImageTag[];
  userPrompt?: string;
}

export interface AIImageStudioMessage {
  id: string;
  type:
    | "user"
    | "assistant"
    | "thinking"
    | "images"
    | "loading"
    | "error"
    | "session_divider";
  content: string;
  enhancedPrompt?: string | null;
  imageRecordIds?: string[];
  images?: AIImageStudioImageResult[];
  timestamp: Date;
  isThinkingComplete?: boolean;
  thinkingDuration?: number;
  prompt?: string;
  sessionId?: string;
  loadingPhase?: AIImageStudioLoadingPhase;
  statusMessages?: string[];
  errorKind?: AIImageStudioErrorKind;
  retryPrompt?: string;
  aspectRatio?: AIImageStudioAspectRatio;
  generationConfig?: AIImageStudioGenerationConfig;
  sessionInfo?: AIImageStudioSessionInfo;
  userPrompt?: string;
}
