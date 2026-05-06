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
  campaignContext?: AIImageStudioCampaignContext;
}

export interface AIImageStudioDrawerProps {
  assignmentLabel?: string;
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
  campaignContext?: AIImageStudioCampaignContext;
  getCurrentOptions?: () => AIImageStudioOpenOptions | null;
  multiBlockFlow?: AIImageStudioMultiBlockFlow;
  subscribeToOptions?: (
    listener: (options: AIImageStudioOpenOptions) => void,
  ) => () => void;
}

export type AIImageStudioCampaignContextAspectRatio =
  | "landscape"
  | "portrait"
  | "square";

export interface AIImageStudioCampaignContext {
  campaignName: string;
  campaignType: string;
  blockType: string;
  blockLabel: string;
  blockContent: Record<string, string>;
  aspectRatioHint: AIImageStudioCampaignContextAspectRatio;
  contentSummary?: string;
}

export type AIImageStudioTab = "ai" | "my-images" | "upload";

export interface AIImageStudioSelectionMetadata {
  altText?: string;
  attribution?: string;
  dimensions?: AIImageStudioImageDimensions | null;
  mimeType?: string | null;
  photographer?: string;
  photographerUrl?: string;
  source: "ai-generated" | "global_image_gallery" | "content_asset" | "upload";
  tags?: AIImageStudioImageTag[];
}

export type AIImageStudioSelectHandler = (
  imageUrl: string,
  metadata?: AIImageStudioSelectionMetadata,
) => void | Promise<void>;

export interface AIImageStudioContextUpdate {
  assignmentLabel?: string;
  blockId?: string;
  campaignContext?: AIImageStudioCampaignContext;
  contentContext?: string;
  contextLabel?: string;
  contextType?: string;
}

export interface AIImageStudioMutableTarget extends AIImageStudioContextUpdate {
  onSelect: AIImageStudioSelectHandler;
}

export interface AIImageStudioMultiBlockFlow {
  advanceToNextTarget: () => AIImageStudioMutableTarget | null;
  hasNextTarget: () => boolean;
}

export interface AIImageStudioOpenOptions {
  assignmentLabel?: string;
  aspectRatioHint?: AIImageStudioAspectRatio;
  blockId?: string;
  browseOnly?: boolean;
  campaignContext?: AIImageStudioCampaignContext;
  channel?: string;
  contentContext?: string;
  contextLabel?: string;
  contextType?: string;
  defaultTab?: AIImageStudioTab;
  multiBlockFlow?: AIImageStudioMultiBlockFlow;
  onClose?: () => void;
  onSelect: AIImageStudioSelectHandler;
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

export type AIImageStudioMood =
  | "natural"
  | "warm"
  | "cool"
  | "dramatic"
  | "soft"
  | "vibrant";

export type AIImageStudioColorPalette =
  | "auto"
  | "earth-tones"
  | "fresh-greens"
  | "soft-pastels"
  | "monochrome";

export interface AIImageStudioGenerationConfig {
  aspectRatio: AIImageStudioAspectRatio;
  stylePreset: AIImageStudioStylePreset;
  quality: AIImageStudioQuality;
  mood: AIImageStudioMood;
  colorPalette: AIImageStudioColorPalette;
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
  actions?: Array<{
    id: "done" | "next-target";
    label: string;
  }>;
  sessionInfo?: AIImageStudioSessionInfo;
  userPrompt?: string;
}
