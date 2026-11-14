import SharedEmailBlockPreview from "../newsletter/SharedEmailBlockPreview";
import type { StudioBlock } from "@/types/studioBlocks";
type Props = {
  block: StudioBlock;
  onUpdateBlockField?: (
    blockId: string,
    field: keyof StudioBlock,
    value: StudioBlock[keyof StudioBlock],
  ) => void;
};
/** The editor uses the same block HTML generator as test and live emails. */
export default function BlockRenderer({ block, onUpdateBlockField }: Props) {
  return (
    <SharedEmailBlockPreview
      block={block}
      onUpdateBlockField={block.type === "footer" ? undefined : onUpdateBlockField}
    />
  );
}
