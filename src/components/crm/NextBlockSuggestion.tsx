import React, { useMemo, useState, useCallback } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { X, Plus } from "lucide-react";

interface Suggestion {
  message: string;
  actionLabel: string;
  layoutType: string;
}

interface NextBlockSuggestionProps {
  blocks: ContentBlock[];
  preheaderText: string;
  onAddBlock: (layoutType: string) => void;
}

function getSuggestion(
  blocks: ContentBlock[],
  preheaderText: string,
): Suggestion | null {
  const visible = blocks.filter((b) => b.visible !== false);

  if (visible.length === 0) {
    return {
      message: "Start with a header block to set the tone for your email.",
      actionLabel: "Add Header",
      layoutType: "email-safe-hero",
    };
  }

  const last = visible[visible.length - 1];

  // After button — suggest preview text if missing
  if (last.type === "button") {
    if (!preheaderText.trim()) {
      return {
        message:
          "This looks send-ready. Consider adding preview text in campaign settings above.",
        actionLabel: "",
        layoutType: "",
      };
    }
    return null;
  }

  // After hero/header — suggest image+text
  if (
    last.type === "email-safe-hero" ||
    last.type === "header" ||
    last.type === "newsletter-header"
  ) {
    return {
      message:
        "A personal story block here builds trust — add an image+text block?",
      actionLabel: "Add Image + Text",
      layoutType: "image-left",
    };
  }

  // After image-text with no CTA anywhere
  if (last.type === "image-text" || last.type === "image") {
    const hasCta = visible.some(
      (b) => b.type === "button" || !!(b.ctaText || b.buttonText),
    );
    if (!hasCta) {
      return {
        message: "Don't leave readers hanging — add a call to action?",
        actionLabel: "Add Button",
        layoutType: "button",
      };
    }
  }

  // After 2+ text-like blocks in a row — suggest visual break
  if (visible.length >= 2) {
    const lastTwo = visible.slice(-2);
    const bothText = lastTwo.every(
      (b) =>
        b.type === "image-text" &&
        !b.imageUrl,
    );
    if (bothText) {
      return {
        message:
          "Readers skim. A visual break here helps — add an image?",
        actionLabel: "Add Image",
        layoutType: "image-full",
      };
    }
  }

  return null;
}

export const NextBlockSuggestion: React.FC<NextBlockSuggestionProps> = ({
  blocks,
  preheaderText,
  onAddBlock,
}) => {
  const [dismissed, setDismissed] = useState<string | null>(null);

  const suggestion = useMemo(
    () => getSuggestion(blocks, preheaderText),
    [blocks, preheaderText],
  );

  const handleAdd = useCallback(() => {
    if (suggestion?.layoutType) {
      onAddBlock(suggestion.layoutType);
      setDismissed(suggestion.message);
    }
  }, [suggestion, onAddBlock]);

  if (!suggestion || suggestion.message === dismissed) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 mt-3">
      <span className="text-sm leading-none mt-0.5">💡</span>
      <p className="flex-1 text-xs italic text-muted-foreground leading-relaxed">
        {suggestion.message}
      </p>
      {suggestion.actionLabel && (
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3 w-3" />
          {suggestion.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => setDismissed(suggestion.message)}
        className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss suggestion"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
