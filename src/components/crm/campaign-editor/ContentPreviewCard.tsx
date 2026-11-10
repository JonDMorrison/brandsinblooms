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
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

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
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [frameHeight, setFrameHeight] = React.useState(600);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const hasContent = blocks.some(
    (block) => block.type !== "footer" && block.visible !== false,
  );
  const html = React.useMemo(
    () =>
      stripScriptTags(
        generateEmailHtml({
          blocks,
          subject: subjectLine || "Newsletter preview",
          previewText,
          footer: blocks.find((block) => block.type === "footer") ?? null,
          mergeData: buildPreviewMergeData(designSystem),
          designSystem,
        }),
      ),
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
