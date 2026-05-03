import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ImagePlus } from "lucide-react";
import type { StudioBlock } from "@/types/studioBlocks";

type FullWidthImageRendererProps = {
  block: StudioBlock;
};

export default function FullWidthImageRenderer({
  block,
}: FullWidthImageRendererProps) {
  const backgroundColor = block.backgroundColor || "#ffffff";
  const borderRadius = block.borderRadius ?? 0;
  const maxHeight = block.maxHeight ?? 400;
  const insetPadding = block.insetPadding ?? block.imagePadding ?? false;
  const showCaption = block.showCaption ?? Boolean(block.caption?.trim());
  const captionAlignment = block.captionAlignment ?? "center";
  const captionColor = block.captionColor || block.textColor || "#6b7280";

  if (!block.imageUrl) {
    return (
      <Box
        sx={{
          height: Math.min(280, maxHeight),
          bgcolor: "neutral.50",
          border: "2px dashed",
          borderColor: "neutral.200",
          borderRadius: `${borderRadius}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <Stack spacing={1} alignItems="center">
          <ImagePlus size={30} color="var(--joy-palette-neutral-300)" />
          <Typography
            level="body-sm"
            sx={{
              color: "neutral.500",
              fontFamily: "var(--studio-font-body)",
              fontWeight: 500,
            }}
          >
            Upload a full-width image
          </Typography>
          <Typography
            level="body-xs"
            sx={{ color: "neutral.400", fontFamily: "var(--studio-font-body)" }}
          >
            Add a caption or link after upload
          </Typography>
        </Stack>
      </Box>
    );
  }

  const image = (
    <Box
      component="img"
      src={block.imageUrl}
      alt={block.imageAlt || ""}
      sx={{
        width: "100%",
        height: `${maxHeight}px`,
        maxHeight: `${maxHeight}px`,
        display: "block",
        objectFit: block.imageFit ?? "cover",
        bgcolor: backgroundColor,
      }}
    />
  );

  return (
    <Box
      sx={{
        p: insetPadding ? 2 : 0,
        bgcolor: insetPadding ? backgroundColor : "transparent",
      }}
    >
      <Box
        component={block.linkUrl ? "a" : "div"}
        href={block.linkUrl || undefined}
        onClick={(event) => event.preventDefault()}
        sx={{
          display: "block",
          lineHeight: 0,
          borderRadius: `${borderRadius}px`,
          overflow: "hidden",
          boxShadow: block.showShadow
            ? "0 10px 30px -20px rgba(15, 23, 42, 0.35)"
            : "none",
        }}
      >
        {image}
      </Box>
      {showCaption && block.caption ? (
        <Typography
          sx={{
            py: 1.25,
            fontFamily: "var(--studio-font-body)",
            fontSize: "12px",
            color: captionColor,
            textAlign: captionAlignment,
            fontStyle: "italic",
            lineHeight: 1.45,
            whiteSpace: "pre-line",
          }}
        >
          {block.caption}
        </Typography>
      ) : null}
    </Box>
  );
}
