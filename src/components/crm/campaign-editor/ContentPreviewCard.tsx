import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowUpRight, Palette, Sparkles } from "lucide-react";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const PREVIEW_EMAIL_WIDTH = 640;
const PREVIEW_EMAIL_HEIGHT = 1120;
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
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(0);
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
        <AspectRatio
          ratio="5/6"
          sx={{
            borderRadius: "xl",
            border: "1px dashed",
            borderColor: "neutral.300",
            background:
              "linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(244,244,245,1) 100%)",
          }}
        >
          <Stack
            spacing={1.25}
            alignItems="center"
            justifyContent="center"
            sx={{ px: 3, textAlign: "center" }}
          >
            <Sparkles size={18} />
            <Typography level="title-sm">
              Preview the finished email here
            </Typography>
            <Typography
              level="body-sm"
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
        </AspectRatio>
      </Card>
    );
  }

  const previewScale = viewportWidth
    ? Math.min(1, Math.max(0.38, (viewportWidth - 24) / PREVIEW_EMAIL_WIDTH))
    : 0.72;
  const viewportHeight = PREVIEW_EMAIL_HEIGHT * previewScale;
  const meaningfulBlockCount = blocks.filter(
    (block) => block.type !== "footer" && block.visible !== false,
  ).length;

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Stack
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

      <Box sx={{ p: 2, backgroundColor: "neutral.100" }}>
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
              backgroundColor: "#ffffff",
            }}
          >
            <iframe
              title="Campaign live preview"
              srcDoc={sanitizedHtml}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </Box>

          <Box
            sx={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              height: 144,
              background:
                "linear-gradient(180deg, rgba(243,244,246,0) 0%, rgba(243,244,246,0.9) 58%, rgba(243,244,246,1) 100%)",
              pointerEvents: "none",
            }}
          />
        </Box>
      </Box>
    </Card>
  );
}
