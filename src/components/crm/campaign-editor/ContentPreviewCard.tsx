import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Palette,
  Sparkles,
} from "lucide-react";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const PREVIEW_EMAIL_WIDTH = 640;
const PREVIEW_EMAIL_HEIGHT = 1120;
const EMPTY_PREVIEW_HEIGHT = 260;
const COLLAPSED_PREVIEW_HEIGHT = 300;
const EXPANDED_PREVIEW_MAX_HEIGHT = "80vh";
const PREVIEW_HEIGHT_TRANSITION =
  "max-height 400ms cubic-bezier(0.4, 0, 0.2, 1)";
const PREVIEW_ARROW_SIZE = 32;
const SAMPLE_CUSTOMER = {
  first_name: "Mira",
  last_name: "Hart",
  email: "preview@studio-preview.test",
  phone: "(555) 014-8821",
};

function stripScriptTags(html: string) {
  return html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
}

function buildPreviewMergeData(designSystem: StudioDesignSystem) {
  const currentDate = new Date().toLocaleDateString();
  const currentYear = new Date().getFullYear().toString();
  const companyName = designSystem.company.name || "Your Company";
  const companyAddress = designSystem.company.addressLines || "";
  const companyPhone = designSystem.company.phone || "";
  const companyEmail = designSystem.company.email || "";
  const companyWebsite = designSystem.company.websiteUrl || "";

  return {
    first_name: SAMPLE_CUSTOMER.first_name,
    last_name: SAMPLE_CUSTOMER.last_name,
    email: SAMPLE_CUSTOMER.email,
    phone: SAMPLE_CUSTOMER.phone,
    lifetime_value: "0",
    total_spent: "0",
    first_purchase_date: "",
    last_purchase_date: "",
    "customer.first_name": SAMPLE_CUSTOMER.first_name,
    "customer.last_name": SAMPLE_CUSTOMER.last_name,
    "customer.email": SAMPLE_CUSTOMER.email,
    "customer.phone": SAMPLE_CUSTOMER.phone,
    "customer.name": SAMPLE_CUSTOMER.first_name,
    customer_name: SAMPLE_CUSTOMER.first_name,
    customerName: SAMPLE_CUSTOMER.first_name,
    firstName: SAMPLE_CUSTOMER.first_name,
    lastName: SAMPLE_CUSTOMER.last_name,
    "company.name": companyName,
    "company.address": companyAddress,
    "company.phone": companyPhone,
    "company.email": companyEmail,
    "company.website": companyWebsite,
    company_name: companyName,
    companyName: companyName,
    "system.unsubscribe_url": "#unsubscribe",
    "system.preferences_url": "#preferences",
    "system.current_year": currentYear,
    "system.current_date": currentDate,
    unsubscribe_url: "#unsubscribe",
    unsubscribeUrl: "#unsubscribe",
  };
}

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
          <Skeleton variant="rounded" width={86} height={24} />
          <Skeleton variant="rounded" width={112} height={24} />
          <Skeleton variant="rounded" width={96} height={24} />
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
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const previewScrollRef = React.useRef<HTMLDivElement | null>(null);
  const collapseScrollTimeoutRef = React.useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const mergeData = React.useMemo(
    () => buildPreviewMergeData(designSystem),
    [designSystem],
  );
  const hasMeaningfulBlocks = React.useMemo(
    () =>
      blocks.some(
        (block) => block.type !== "footer" && block.visible !== false,
      ),
    [blocks],
  );
  const footerBlock = React.useMemo(
    () => blocks.find((block) => block.type === "footer") ?? null,
    [blocks],
  );
  const html = React.useMemo(
    () =>
      generateEmailHtml({
        blocks,
        subject: subjectLine || "Untitled Campaign",
        previewText,
        footer: footerBlock,
        mergeData,
        designSystem,
      }),
    [blocks, designSystem, footerBlock, mergeData, previewText, subjectLine],
  );
  const sanitizedHtml = React.useMemo(() => stripScriptTags(html), [html]);

  React.useEffect(() => {
    if (!hasMeaningfulBlocks) {
      setIsExpanded(false);
    }
  }, [hasMeaningfulBlocks]);

  React.useEffect(() => {
    return () => {
      if (collapseScrollTimeoutRef.current !== null) {
        window.clearTimeout(collapseScrollTimeoutRef.current);
      }
    };
  }, []);

  const handleExpandPreview = React.useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleCollapsePreview = React.useCallback(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }

    setIsExpanded(false);

    if (collapseScrollTimeoutRef.current !== null) {
      window.clearTimeout(collapseScrollTimeoutRef.current);
    }

    collapseScrollTimeoutRef.current = window.setTimeout(() => {
      headerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      collapseScrollTimeoutRef.current = null;
    }, 50);
  }, []);

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setViewportWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  if (loading) {
    return <PreviewSkeleton />;
  }

  if (!hasMeaningfulBlocks) {
    return (
      <Card variant="outlined" sx={{ borderRadius: "xl", p: 2.5, gap: 2 }}>
        <Stack spacing={0.75}>
          <Typography level="title-md">Live preview</Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.600", maxWidth: 560 }}
          >
            Apply a seasonal template or open Campaign Studio to start shaping
            the email. This surface reuses the same HTML generator as your send
            and test-email flows.
          </Typography>
        </Stack>
        <Box
          sx={{
            minHeight: EMPTY_PREVIEW_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "xl",
            border: "1px dashed",
            borderColor: "neutral.300",
            bgcolor: "background.level1",
          }}
        >
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ width: "100%", px: 3, textAlign: "center" }}
          >
            <Sparkles size={18} />
            <Typography level="title-sm" sx={{ fontWeight: 600 }}>
              Preview the finished email here
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.600", maxWidth: 360 }}
            >
              Real Studio blocks, real merge-tag sampling, and the same email
              HTML pipeline used everywhere else.
            </Typography>
            <Button
              variant="solid"
              color="neutral"
              startDecorator={<Palette size={16} />}
              onClick={onOpenStudio}
            >
              Open Campaign Studio
            </Button>
          </Stack>
        </Box>
      </Card>
    );
  }

  const previewScale = viewportWidth
    ? Math.min(1, Math.max(0.38, (viewportWidth - 24) / PREVIEW_EMAIL_WIDTH))
    : 0.72;
  const viewportHeight = PREVIEW_EMAIL_HEIGHT * previewScale;
  const canExpandPreview = viewportHeight > COLLAPSED_PREVIEW_HEIGHT;
  const meaningfulBlockCount = blocks.filter(
    (block) => block.type !== "footer" && block.visible !== false,
  ).length;

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Stack
        ref={headerRef}
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "neutral.200" }}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography level="title-md">Live preview</Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.600", maxWidth: 620 }}
          >
            {subjectLine || "Untitled Campaign"}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="sm" variant="soft" color="neutral">
              {meaningfulBlockCount} block
              {meaningfulBlockCount === 1 ? "" : "s"}
            </Chip>
            <Chip size="sm" variant="soft" color="neutral">
              Preheader {previewText.trim() ? "ready" : "empty"}
            </Chip>
            <Chip size="sm" variant="soft" color="neutral">
              HTML parity preview
            </Chip>
          </Stack>
        </Stack>

        <Button
          variant="solid"
          color="neutral"
          endDecorator={<ArrowUpRight size={16} />}
          onClick={onOpenStudio}
        >
          Open Campaign Studio
        </Button>
      </Stack>

      <Box sx={{ px: 2, pt: 2, pb: 4, bgcolor: "background.level1" }}>
        <Box
          sx={{
            position: "relative",
            borderRadius: "xl",
            border: "1px dashed",
            borderColor: "neutral.300",
            bgcolor: "background.level1",
            p: 1.5,
            overflow: "visible",
          }}
        >
          <Box
            ref={previewScrollRef}
            sx={{
              maxHeight: isExpanded
                ? EXPANDED_PREVIEW_MAX_HEIGHT
                : COLLAPSED_PREVIEW_HEIGHT,
              overflowY: isExpanded ? "auto" : "hidden",
              overflowX: "hidden",
              transition: PREVIEW_HEIGHT_TRANSITION,
            }}
          >
            <Box
              ref={viewportRef}
              sx={{ position: "relative", minHeight: viewportHeight }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  width: PREVIEW_EMAIL_WIDTH,
                  height: PREVIEW_EMAIL_HEIGHT,
                  transform: `translateX(-50%) scale(${previewScale})`,
                  transformOrigin: "top center",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.12)",
                  bgcolor: "background.surface",
                }}
              >
                <iframe
                  title="Campaign live preview"
                  srcDoc={sanitizedHtml}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              </Box>

              {!isExpanded && canExpandPreview ? (
                <Box
                  sx={{
                    position: "absolute",
                    insetInline: 0,
                    bottom: 0,
                    height: 60,
                    background:
                      "linear-gradient(180deg, transparent 0%, var(--joy-palette-background-level1) 100%)",
                    pointerEvents: "none",
                  }}
                />
              ) : null}
            </Box>
          </Box>

          <Tooltip
            title={isExpanded ? "Collapse preview" : "Show full preview"}
            placement="top"
            size="sm"
          >
            <IconButton
              variant="soft"
              color="neutral"
              size="sm"
              onClick={isExpanded ? handleCollapsePreview : handleExpandPreview}
              aria-label={isExpanded ? "Collapse preview" : "Show full preview"}
              sx={{
                position: "absolute",
                bottom: -16,
                left: "50%",
                transform: "translateX(-50%)",
                width: PREVIEW_ARROW_SIZE,
                height: PREVIEW_ARROW_SIZE,
                minWidth: PREVIEW_ARROW_SIZE,
                minHeight: PREVIEW_ARROW_SIZE,
                borderRadius: "50%",
                bgcolor: "background.surface",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "sm",
                zIndex: 1,
                transition: "transform 300ms ease, box-shadow 150ms ease",
                "&:hover": {
                  bgcolor: "background.level1",
                  boxShadow: "md",
                  transform: "translateX(-50%) translateY(-1px)",
                },
              }}
            >
              <ChevronDown
                size={16}
                style={{
                  transition: "transform 300ms ease",
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Card>
  );
}
