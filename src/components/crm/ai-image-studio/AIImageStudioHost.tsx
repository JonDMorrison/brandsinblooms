import React from "react";
import { AIImageStudioDrawer } from "./AIImageStudioDrawer";
import type { AIImageStudioOpenOptions } from "./types";

interface AIImageStudioHostProps {
  onClose: () => void;
  open: boolean;
  options: AIImageStudioOpenOptions;
}

export default function AIImageStudioHost({
  onClose,
  open,
  options,
}: AIImageStudioHostProps) {
  return (
    <AIImageStudioDrawer
      aspectRatioHint={options.aspectRatioHint}
      blockId={options.blockId}
      browseOnly={options.browseOnly}
      channel={options.channel}
      contentContext={options.contentContext}
      contextLabel={options.contextLabel}
      contextType={options.contextType}
      defaultTab={options.defaultTab}
      onClose={onClose}
      onImageSelect={options.onSelect}
      open={open}
    />
  );
}
