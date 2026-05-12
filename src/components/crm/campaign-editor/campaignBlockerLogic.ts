export type CampaignBlockerKind =
  | "sender-unverified"
  | "audience-empty"
  | "content-empty"
  | "subject-empty"
  | "draft-conflict";

export interface CampaignBlockerInput {
  senderUnverified?: boolean;
  audienceEmpty?: boolean;
  contentEmpty?: boolean;
  subjectEmpty?: boolean;
  draftConflict?: boolean;
}

export interface CampaignBlockerHandlers {
  onVerifySender?: () => void;
  onScrollToAudience?: () => void;
  onScrollToContent?: () => void;
  onScrollToSubject?: () => void;
  onReload?: () => void;
}

export interface ResolvedCampaignBlocker {
  kind: CampaignBlockerKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function resolveCampaignBlocker(
  input: CampaignBlockerInput,
  handlers: CampaignBlockerHandlers,
): ResolvedCampaignBlocker | null {
  if (input.senderUnverified) {
    return {
      kind: "sender-unverified",
      message: "Verify your sender email to send",
      actionLabel: "Verify sender",
      onAction: handlers.onVerifySender,
    };
  }
  if (input.audienceEmpty) {
    return {
      kind: "audience-empty",
      message: "Pick who this is for",
      actionLabel: "Choose audience",
      onAction: handlers.onScrollToAudience,
    };
  }
  if (input.contentEmpty) {
    return {
      kind: "content-empty",
      message: "Add some content to your campaign",
      actionLabel: "Add content",
      onAction: handlers.onScrollToContent,
    };
  }
  if (input.subjectEmpty) {
    return {
      kind: "subject-empty",
      message: "Add a subject line",
      actionLabel: "Add subject",
      onAction: handlers.onScrollToSubject,
    };
  }
  if (input.draftConflict) {
    return {
      kind: "draft-conflict",
      message: "This campaign was edited elsewhere. Reload to continue.",
      actionLabel: "Reload",
      onAction: handlers.onReload,
    };
  }
  return null;
}
