import React, { useMemo, useState, useCallback } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { X, Plus } from "lucide-react";

type SuggestedBlockKind =
  | "header"
  | "image_text"
  | "button"
  | "product_gallery";

interface Suggestion {
  key: string;
  message: string;
  actionLabel: string;
  blockKind?: SuggestedBlockKind;
}

interface NextBlockSuggestionProps {
  blocks: ContentBlock[];
  preheaderText?: string;
  onAddBlockKind: (blockKind: SuggestedBlockKind) => void;
}

function getSuggestion(
  blocks: ContentBlock[],
  preheaderText: string,
): Suggestion | null {
  const visible = blocks.filter((b) => b.visible !== false);
  const signature = `${visible.length}:${visible
    .map((block) => `${block.type}:${block.layout ?? ""}`)
    .join(
      "|",
    )}:${preheaderText.trim() ? "with-preheader" : "without-preheader"}`;
  const hasHeader = visible.some((block) =>
    ["email-safe-hero", "header", "newsletter-header", "graphic-hero"].includes(
      block.type,
    ),
  );
  const hasImageText = visible.some((block) => block.type === "image-text");
  const hasButton = visible.some(
    (block) =>
      block.type === "button" ||
      !!(block.ctaText || block.ctaUrl || block.buttonText || block.buttonUrl),
  );
  const hasProductGallery = visible.some(
    (block) => block.type === "product-gallery",
  );

  if (!hasHeader) {
    return {
      key: `header:${signature}`,
      message: "Start with a header block to set the tone for your email.",
      actionLabel: "Add Header",
      blockKind: "header",
    };
  }

  if (!hasImageText) {
    return {
      key: `image_text:${signature}`,
      message:
        "A personal story block here builds trust — add an image+text block?",
      actionLabel: "Add Image + Text",
      blockKind: "image_text",
    };
  }

  if (!hasButton && visible.length >= 2) {
    return {
      key: `button:${signature}`,
      message: "Don't leave readers hanging — add a call to action?",
      actionLabel: "Add Button",
      blockKind: "button",
    };
  }

  if (!hasProductGallery && hasButton && visible.length >= 2) {
    return {
      key: `product_gallery:${signature}`,
      message: "Want to feature products next? Add a product gallery.",
      actionLabel: "Add Product Gallery",
      blockKind: "product_gallery",
    };
  }

  if (!preheaderText.trim()) {
    return {
      key: `preheader:${signature}`,
      message:
        "This looks send-ready. Consider adding preview text in campaign settings above.",
      actionLabel: "",
    };
  }

  return null;
}

export const NextBlockSuggestion: React.FC<NextBlockSuggestionProps> = ({
  blocks,
  preheaderText,
  onAddBlockKind,
}) => {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const suggestion = useMemo(
    () => getSuggestion(blocks, preheaderText ?? ""),
    [blocks, preheaderText],
  );

  const handleAdd = useCallback(() => {
    if (suggestion?.blockKind) {
      onAddBlockKind(suggestion.blockKind);
      setDismissedKey(suggestion.key);
    }
  }, [suggestion, onAddBlockKind]);

  if (!suggestion || suggestion.key === dismissedKey) return null;

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
        onClick={() => setDismissedKey(suggestion.key)}
        className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss suggestion"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
