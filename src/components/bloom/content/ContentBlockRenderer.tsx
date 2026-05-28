import { BlockRenderer } from "@/components/bloom/blocks/BlockRenderer";
import { BloomErrorCard } from "@/components/bloom/content/BloomErrorCard";
import { BloomTextBlock } from "@/components/bloom/content/BloomTextBlock";
import { BloomThinkingBlock } from "@/components/bloom/content/BloomThinkingBlock";
import { BloomToolResultCard } from "@/components/bloom/content/BloomToolResultCard";
import type { BloomContentBlock } from "@/components/bloom/content/parseContentBlocks";

interface ContentBlockRendererProps {
  block: BloomContentBlock;
  onAction?: (prompt: string) => void;
  onRetry?: () => void;
}

export function ContentBlockRenderer({
  block,
  onAction,
  onRetry,
}: ContentBlockRendererProps) {
  switch (block.type) {
    case "text":
      return <BloomTextBlock content={block.content} />;
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
