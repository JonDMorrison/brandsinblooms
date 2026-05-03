import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useOptionalDesignSystem } from "@/contexts/DesignSystemContext";
import type { StudioBlock } from "@/types/studioBlocks";

type DividerRendererProps = {
  block: StudioBlock;
};

function getJustifyContent(alignment: StudioBlock["textAlign"]) {
  switch (alignment) {
    case "left":
      return "flex-start";
    case "right":
      return "flex-end";
    default:
      return "center";
  }
}

function resolveLineColor(
  block: StudioBlock,
  designSystem?: { colors: { text?: string } } | null,
) {
  const rawLineColor = block.lineColor?.trim().toLowerCase();
  const designTint = designSystem?.colors.text
    ? `color-mix(in srgb, ${designSystem.colors.text} 18%, transparent)`
    : "#d1d5db";

  if (!rawLineColor || rawLineColor === "#d1d5db") {
    return designTint;
  }

  return block.lineColor || designTint;
}

function DividerLine({
  block,
  designSystem,
}: {
  block: StudioBlock;
  designSystem?: { colors: { text?: string } } | null;
}) {
  const lineStyle = block.lineType ?? block.lineStyle ?? "solid";

  return (
    <Box
      sx={{
        width: `${block.lineWidth ?? 100}%`,
        maxWidth: "100%",
        borderTop: `${block.lineThickness ?? 1}px ${lineStyle} ${resolveLineColor(block, designSystem)}`,
      }}
    />
  );
}

export default function DividerRenderer({ block }: DividerRendererProps) {
  const designSystem = useOptionalDesignSystem()?.designSystem;
  const layout = block.layout || "simple-line";
  const justifyContent = getJustifyContent(block.textAlign);
  const paddingTop = block.paddingTop ?? 20;
  const paddingBottom = block.paddingBottom ?? 20;
  const lineStyle = block.lineType ?? block.lineStyle ?? "solid";
  const showOrnament = block.showOrnament ?? layout === "ornamental";

  if (showOrnament) {
    return (
      <Box
        sx={{
          bgcolor: block.backgroundColor || "#ffffff",
          px: 4,
          pt: `${paddingTop}px`,
          pb: `${paddingBottom}px`,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent={justifyContent}
          sx={{ width: "100%" }}
        >
          <Box
            sx={{
              width: `${Math.max(16, Math.min(48, block.lineWidth ?? 42))}%`,
              borderTop: `${block.lineThickness ?? 1}px ${lineStyle} ${resolveLineColor(block, designSystem)}`,
            }}
          />
          <Typography
            sx={{
              color:
                block.ornamentColor ||
                designSystem?.colors.text ||
                block.lineColor ||
                "#111827",
              fontSize: `${block.ornamentSize ?? 16}px`,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            {block.ornamentSymbol || "✦"}
          </Typography>
          <Box
            sx={{
              width: `${Math.max(16, Math.min(48, block.lineWidth ?? 42))}%`,
              borderTop: `${block.lineThickness ?? 1}px ${lineStyle} ${resolveLineColor(block, designSystem)}`,
            }}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: block.backgroundColor || "#ffffff",
        px: 4,
        pt: `${paddingTop}px`,
        pb: `${paddingBottom}px`,
      }}
    >
      <Stack
        direction="row"
        justifyContent={justifyContent}
        sx={{ width: "100%" }}
      >
        <DividerLine block={block} designSystem={designSystem} />
      </Stack>
    </Box>
  );
}
