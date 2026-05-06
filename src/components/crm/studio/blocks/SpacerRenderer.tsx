import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { StudioBlock } from "@/types/studioBlocks";

type SpacerRendererProps = {
  block: StudioBlock;
};

export default function SpacerRenderer({ block }: SpacerRendererProps) {
  const height = Math.max(0, block.spacerHeight ?? 32);
  const showOutline = block.showDottedOutline ?? true;

  return (
    <Box
      sx={{
        bgcolor: block.backgroundColor || "transparent",
        minHeight: `${height}px`,
        height: `${height}px`,
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {showOutline ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{
            width: "100%",
            minHeight: Math.max(8, height),
            border: "1px dashed",
            borderColor: "neutral.300",
            borderRadius: "6px",
            bgcolor: "rgba(248, 250, 252, 0.72)",
            color: "neutral.400",
            opacity: height === 0 ? 0.5 : 1,
            pointerEvents: "none",
          }}
        >
          <Box sx={{ width: 20, borderTop: "1px dashed currentColor" }} />
          <Typography sx={{ fontSize: "11px", fontWeight: 700, lineHeight: 1 }}>
            {height}px spacer
          </Typography>
          <Box sx={{ width: 20, borderTop: "1px dashed currentColor" }} />
        </Stack>
      ) : null}
    </Box>
  );
}
