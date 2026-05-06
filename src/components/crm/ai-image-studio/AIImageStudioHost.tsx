import React from "react";
import { AIImageStudioDrawer } from "./AIImageStudioDrawer";
import type { AIImageStudioOpenOptions } from "./types";

interface AIImageStudioHostProps {
  getCurrentOptions: () => AIImageStudioOpenOptions | null;
  onClose: () => void;
  open: boolean;
  options: AIImageStudioOpenOptions;
  subscribeToOptions: (
    listener: (options: AIImageStudioOpenOptions) => void,
  ) => () => void;
}

export default function AIImageStudioHost({
  getCurrentOptions,
  onClose,
  open,
  options,
  subscribeToOptions,
}: AIImageStudioHostProps) {
  return (
    <AIImageStudioDrawer
      aspectRatioHint={options.aspectRatioHint}
      assignmentLabel={options.assignmentLabel}
      blockId={options.blockId}
      browseOnly={options.browseOnly}
      campaignContext={options.campaignContext}
      channel={options.channel}
      contentContext={options.contentContext}
      contextLabel={options.contextLabel}
      contextType={options.contextType}
      defaultTab={options.defaultTab}
      getCurrentOptions={getCurrentOptions}
      multiBlockFlow={options.multiBlockFlow}
      onClose={onClose}
      onImageSelect={options.onSelect}
      open={open}
      subscribeToOptions={subscribeToOptions}
    />
  );
}
