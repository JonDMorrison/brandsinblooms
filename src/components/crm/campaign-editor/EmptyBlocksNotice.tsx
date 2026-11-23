import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
import { isEmptyContentBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

/** Visible, non-footer blocks a customer would see nothing in. */
export function findEmptyContentBlocks(blocks: StudioBlock[]) {
  return blocks.filter(
    (block) =>
      block.type !== "footer" &&
      block.visible !== false &&
      isEmptyContentBlock(block),
  );
}

/**
 * Lists empty blocks before sending. They are already left out of the email,
 * but they still clutter the design, so offer to remove them in one step.
 */
export function EmptyBlocksNotice({
  blocks,
  disabled = false,
  onRemove,
}: {
  blocks: StudioBlock[];
  disabled?: boolean;
  onRemove: (remaining: StudioBlock[]) => void;
}) {
  const empty = React.useMemo(() => findEmptyContentBlocks(blocks), [blocks]);
  if (empty.length === 0) return null;
  const emptyIds = new Set(empty.map((block) => block.id));

  return (
    <Sheet
      variant="soft"
      color="warning"
      data-testid="empty-blocks-notice"
      sx={{ borderRadius: "md", p: 1.5 }}
    >
      <Stack spacing={1}>
        <Typography level="title-sm">
          {empty.length === 1
            ? "1 empty block won't appear in the email"
            : `${empty.length} empty blocks won't appear in the email`}
        </Typography>
        <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5 }}>
          {empty.map((block) => (
            <Typography component="li" key={block.id} level="body-sm">
              {block.label || STUDIO_BLOCK_LOOKUP[block.type]?.name || block.type}
            </Typography>
          ))}
        </Stack>
        <JoyButton
          size="sm"
          variant="outlined"
          color="neutral"
          startDecorator={<Trash2 size={14} />}
          disabled={disabled}
          sx={{ alignSelf: "flex-start" }}
          onClick={() => onRemove(blocks.filter((block) => !emptyIds.has(block.id)))}
        >
          Remove empty blocks
        </JoyButton>
      </Stack>
    </Sheet>
  );
}
