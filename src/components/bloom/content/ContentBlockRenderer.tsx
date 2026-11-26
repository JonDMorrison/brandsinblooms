import { BlockRenderer } from "@/components/bloom/blocks/BlockRenderer";
import { BloomErrorCard } from "@/components/bloom/content/BloomErrorCard";
import { BloomTextBlock } from "@/components/bloom/content/BloomTextBlock";
import { BloomThinkingBlock } from "@/components/bloom/content/BloomThinkingBlock";
import { BloomToolResultCard } from "@/components/bloom/content/BloomToolResultCard";
import type { BloomContentBlock } from "@/components/bloom/content/parseContentBlocks";
import type { BloomMarkdownVariant } from "@/components/bloom/BloomMarkdown";

interface ContentBlockRendererProps {
  block: BloomContentBlock;
  onAction?: (prompt: string) => void;
  onRetry?: () => void;
  /** Markdown reading style; "panel" is the Ask Bloom drawer's. */
  markdownVariant?: BloomMarkdownVariant;
}

/**
 * The one Bloom message-content renderer. The Ask Bloom drawer and the /bloom
 * workspace (persisted and streaming messages) render message text and result
 * blocks through it.
 */
export function ContentBlockRenderer({
  block,
  markdownVariant,
  onAction,
  onRetry,
}: ContentBlockRendererProps) {
  switch (block.type) {
    case "text":
      return (
        <BloomTextBlock content={block.content} variant={markdownVariant} />
      );
    case "thinking":
      return <BloomThinkingBlock content={block.content} />;
    case "tool_result":
      return (
        <BloomToolResultCard
          blockType={block.blockType}
          count={block.count}
          data={block.data}
          error={block.error}
          message={block.message}
          onAction={onAction}
          onRetry={onRetry}
          status={block.status}
          toolName={block.toolName}
        />
      );
    case "error":
      return <BloomErrorCard message={block.message} onRetry={onRetry} />;
    case "block":
      return (
        <BlockRenderer
          blockType={block.blockType}
          payload={block.payload}
          onAction={(prompt) => onAction?.(prompt)}
        />
      );
  }
}
