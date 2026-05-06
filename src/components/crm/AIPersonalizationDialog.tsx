import React from "react";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import type { AIPersonalizationDialogProps } from "./ai-image-studio/types";

export type { AIPersonalizationDialogProps } from "./ai-image-studio/types";

export const AIPersonalizationDialog: React.FC<
  AIPersonalizationDialogProps
> = ({ open, onImageSelect, onOpenChange, ...props }) => {
  const { close, isOpen, open: openStudio } = useAIImageStudio();
  const openedByBridgeRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    openedByBridgeRef.current = true;
    openStudio({
      ...props,
      onClose: () => {
        openedByBridgeRef.current = false;
        onOpenChange(false);
      },
      onSelect: onImageSelect,
    });
  }, [open, onImageSelect, onOpenChange, openStudio, props]);

  React.useEffect(() => {
    if (!open && openedByBridgeRef.current && isOpen) {
      openedByBridgeRef.current = false;
      close();
    }
  }, [close, isOpen, open]);

  return null;
};
