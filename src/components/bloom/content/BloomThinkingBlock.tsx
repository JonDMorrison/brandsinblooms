import { ThinkingBlock } from "@/components/bloom/blocks/ThinkingBlock";

export function BloomThinkingBlock({ content }: { content: string }) {
  return (
    <ThinkingBlock
      content={content}
      defaultExpanded={false}
      isStreaming={false}
    />
  );
}
