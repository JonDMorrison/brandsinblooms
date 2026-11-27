import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowUpRight, Palette } from "lucide-react";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import { buildCampaignPreviewHtml } from "@/lib/crm/campaignPreviewHtml";
import type { StudioBlock } from "@/types/studioBlocks";

function PreviewSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Stack spacing={1.25} sx={{ p: 2.5 }}>
        <Skeleton variant="text" width="22%" />
        <Skeleton variant="text" width="68%" />
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Skeleton variant="rectangular" width={86} height={24} />
          <Skeleton variant="rectangular" width={112} height={24} />
          <Skeleton variant="rectangular" width={96} height={24} />
        </Stack>
      </Stack>
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <AspectRatio
          ratio="5/6"
          sx={{ borderRadius: "xl", overflow: "hidden" }}
        >
          <Skeleton variant="rectangular" />
        </AspectRatio>
      </Box>
    </Card>
  );
}

export function ContentPreviewCard({
  blocks,
  subjectLine,
  previewText,
  designSystem,
  loading = false,
  onOpenStudio,
}: {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  designSystem: StudioDesignSystem;
  loading?: boolean;
  onOpenStudio: () => void;
}) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [frameHeight, setFrameHeight] = React.useState(600);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const hasContent = blocks.some(
    (block) => block.type !== "footer" && block.visible !== false,
  );
  const html = React.useMemo(
    () =>
      buildCampaignPreviewHtml({ blocks, subjectLine, previewText, designSystem }),
    [blocks, designSystem, previewText, subjectLine],
  );
  React.useEffect(() => () => observerRef.current?.disconnect(), []);
  const handleFrameLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    observerRef.current?.disconnect();
    const doc = event.currentTarget.contentDocument;
    if (!doc?.body) return;
    const measure = () =>
      setFrameHeight(Math.max(320, doc.body.scrollHeight + 24));
    measure();
    doc.addEventListener("click", (event) => event.preventDefault());
    if (typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(doc.body);
    }
  };
  if (loading) return <PreviewSkeleton />;
  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        p: 0,
        borderRadius: "xl",
        overflow: "hidden",
        bgcolor: "background.surface",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderBottom: "1px solid",
          borderColor: "neutral.200",
        }}
      >
        <Stack spacing={0.75}>
          <Typography level="h3" sx={{ fontSize: 22, fontWeight: 700 }}>
            Your newsletter
          </Typography>
          <Typography level="body-sm" textColor="text.secondary">
            Check your design here. Change text, images, colours, and layout in
            Design Studio.
          </Typography>
        </Stack>
        <Button
          variant="solid"
          endDecorator={<ArrowUpRight size={18} />}
          onClick={onOpenStudio}
          sx={{
            minHeight: 44,
            flexShrink: 0,
            px: 2.5,
            bgcolor: "#244d46",
            "&:hover": { bgcolor: "#183c35" },
          }}
        >
          Edit in Design Studio
        </Button>
      </Stack>
      {hasContent ? (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ px: 3, py: 2, bgcolor: "neutral.50" }}
          >
            <Typography level="body-sm" textColor="text.secondary">
              Personalisation uses a sample customer. Scroll the page to see the
              full email.
            </Typography>
            <Stack direction="row" spacing={0.75}>
              <Button
                variant={device === "desktop" ? "solid" : "outlined"}
                color="neutral"
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
                sx={{ minHeight: 40 }}
              >
                Desktop
              </Button>
              <Button
                variant={device === "mobile" ? "solid" : "outlined"}
                color="neutral"
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
                sx={{ minHeight: 40 }}
              >
                Mobile
              </Button>
            </Stack>
          </Stack>
          <Box
            sx={{
              width: "100%",
              px: { xs: 1, md: 3 },
              py: 3,
              bgcolor: "#f0f3f2",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: device === "mobile" ? 390 : "100%",
                mx: "auto",
                bgcolor: "#fff",
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "md",
                overflow: "hidden",
                boxShadow: "0 4px 18px rgba(24,45,38,.06)",
              }}
            >
              <iframe
                title="Campaign live preview"
                sandbox="allow-same-origin"
                srcDoc={html}
                scrolling="no"
                onLoad={handleFrameLoad}
                style={{
                  display: "block",
                  width: "100%",
                  height: frameHeight,
                  border: 0,
                }}
              />
            </Box>
          </Box>
        </>
      ) : (
        <Stack
          alignItems="center"
          spacing={1.5}
          sx={{ py: 6, px: 3, textAlign: "center", bgcolor: "neutral.50" }}
        >
          <Palette size={32} />
          <Typography level="title-lg">
            A blank canvas, ready for your ideas
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Open Design Studio to add your first text, image, or product block.
          </Typography>
        </Stack>
      )}
    </Card>
  );
}
