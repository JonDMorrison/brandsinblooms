import Box from "@mui/joy/Box";
import FooterRenderer from "./FooterRenderer";
import SharedEmailBlockPreview from "../newsletter/SharedEmailBlockPreview";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
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
  const { designSystem } = useDesignSystem();
  if (block.type !== "footer")
    return (
      <SharedEmailBlockPreview
        block={block}
        onUpdateBlockField={onUpdateBlockField}
      />
    );
  return (
    <Box
      sx={{
        "--studio-font-brand": designSystem.typography.brandFamily,
        "--studio-font-headline": designSystem.typography.headlineFamily,
        "--studio-font-subheading": designSystem.typography.subheadingFamily,
        "--studio-font-body": designSystem.typography.bodyFamily,
        "--studio-font-button": designSystem.typography.buttonFamily,
        "--joy-fontFamily-body": designSystem.typography.bodyFamily,
      }}
    >
      <FooterRenderer block={block} />
    </Box>
  );
}
