import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ZoomIn, ZoomOut } from "lucide-react";

type StudioBottomBarProps = {
  blockCount: number;
  wordCountEstimate: number;
  canvasWidth: number;
  dropLabel: string | null;
};

const bottomTextSx = {
  color: "neutral.400",
  fontSize: "11px",
};

const bottomDividerSx = {
  width: "1px",
  height: 14,
  bgcolor: "rgba(0,0,0,0.08)",
};

export default function StudioBottomBar({
  blockCount,
  wordCountEstimate,
  canvasWidth,
  dropLabel,
}: StudioBottomBarProps) {
  const blockCountLabel = blockCount === 1 ? "1 block" : `${blockCount} blocks`;

  return (
    <Sheet
      sx={{
        height: 36,
        bgcolor: "background.surface",
        boxShadow: "0 -1px 0 0 rgba(0,0,0,0.06)",
      }}
    >
      <Box
        sx={{
          px: 2,
          height: 36,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography level="body-xs" sx={bottomTextSx}>
            {blockCountLabel}
          </Typography>
          <Box sx={bottomDividerSx} />
          <Typography level="body-xs" sx={bottomTextSx}>
            ~{wordCountEstimate} words
          </Typography>
        </Stack>

        <Box sx={{ minWidth: 0, minHeight: 20 }}>
          {dropLabel ? (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              justifyContent="center"
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "primary.500",
                  animation: "studio-drop-pulse 1.2s ease-in-out infinite",
                  "@keyframes studio-drop-pulse": {
                    "0%": { opacity: 0.4, transform: "scale(0.8)" },
                    "50%": { opacity: 1, transform: "scale(1)" },
                    "100%": { opacity: 0.4, transform: "scale(0.8)" },
                  },
                }}
              />
              <Typography
                level="body-xs"
                sx={{ color: "primary.500", fontSize: "11px" }}
              >
                Drop to add {dropLabel}
              </Typography>
            </Stack>
          ) : null}
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          justifyContent="flex-end"
        >
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            disabled
            aria-label="Zoom out"
            sx={{ opacity: 0.4 }}
          >
            <ZoomOut size={14} />
          </IconButton>
          <Typography
            level="body-xs"
            sx={{ ...bottomTextSx, minWidth: 40, textAlign: "center" }}
          >
            100%
          </Typography>
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            disabled
            aria-label="Zoom in"
            sx={{ opacity: 0.4 }}
          >
            <ZoomIn size={14} />
          </IconButton>
          <Box sx={bottomDividerSx} />
          <Typography
            level="body-xs"
            sx={{ ...bottomTextSx, fontFamily: "SF Mono, Menlo, monospace" }}
          >
            {canvasWidth}px
          </Typography>
        </Stack>
      </Box>
    </Sheet>
  );
}
