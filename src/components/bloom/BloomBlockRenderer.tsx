import { useBloom } from "@/components/bloom/BloomContext";
import { BloomMarkdown } from "@/components/bloom/BloomMarkdown";
import { BlockRenderer } from "@/components/bloom/blocks/BlockRenderer";
import { normalizeBloomBlockItems } from "@/components/bloom/blocks/blockUtils";
import type {
  BloomBlockActionContext,
  BloomBlockItem,
} from "@/components/bloom/blocks/blockTypes";
import type { BloomMessage } from "@/hooks/bloom/types";
import Stack from "@mui/joy/Stack";

interface BloomBlockRendererProps {
  message: BloomMessage;
  blocks?: BloomBlockItem[];
}

export function BloomBlockRenderer({
  blocks,
  message,
}: BloomBlockRendererProps) {
  const { sendMessage } = useBloom();
  const blockItems = blocks ?? normalizeBloomBlockItems(message.blockData);

  if (blockItems.length === 0) {
    return null;
  }

  const handleAction = (action: string, _context: BloomBlockActionContext) => {
    const prompt = action.trim();
    if (!prompt) {
      return;
    }
    void sendMessage(prompt).catch(() => undefined);
  };

  return (
    <Stack spacing={1}>
      {blockItems.map((block, index) =>
        block.text ? (
          <BloomMarkdown key={`${block.id}-${index}`} content={block.text} />
        ) : (
          <BlockRenderer
            key={`${block.id}-${index}`}
            blockType={block.blockType}
            payload={block.payload}
            onAction={handleAction}
          />
        ),
      )}
    </Stack>
  );
}
