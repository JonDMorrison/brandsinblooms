import * as React from "react";
import QRCode from "qrcode";
import Link from "@mui/joy/Link";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Link2,
  Mail,
  QrCode,
  Server,
  Terminal,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "sonner";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { trackFormBuilderAnalyticsEvent } from "@/lib/forms/analytics";
import type { PublishValidationIssue } from "@/lib/forms/publish";
import {
  STATIC_EMBED_RUNTIME_VERSION,
  buildCurlSubmissionSnippet,
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildNextJsSubmissionSnippet,
  buildReactSubmissionSnippet,
  getPublicFormSubmissionEndpoint,
  getPublicFormUrl,
  type FormEmbedDisplayMode,
} from "@/lib/forms/share";
import type { Form } from "@/types/formBuilder";

type LegacyInitialTab =
  | "share-link"
  | "embed-code"
  | "developer"
  | "direct-link"
  | "iframe"
  | "javascript"
  | "react";

type PublishTabAnalyticsSurface = "share-dialog" | "publish-success";
type ShareMethodKey =
  | "direct_link"
  | "qr_code"
  | "javascript_embed"
  | "iframe_embed"
  | "api_endpoint"
  | "curl"
  | "react_component"
  | "nextjs_server_action";

interface FormPublishTabProps {
  analyticsSurface?: PublishTabAnalyticsSurface;
  form: Pick<Form, "id" | "name" | "status" | "embed_key" | "fields_json">;
  initialTab?: LegacyInitialTab;
  isActive?: boolean;
  publishValidationIssues?: PublishValidationIssue[];
  onPublish?: () => void | Promise<void>;
  onUnpublish?: () => void | Promise<void>;
  isStatusUpdating?: boolean;
}

const DISPLAY_MODE_OPTIONS: Array<{
  value: FormEmbedDisplayMode;
  label: string;
}> = [
  { value: "inline", label: "Inline" },
  { value: "modal", label: "Modal" },
  { value: "slide-in", label: "Slide-in" },
];

const codeFontFamily =
  'var(--joy-fontFamily-code, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function PublishLoadingState() {
  return (
    <Stack spacing={3}>
      <Skeleton
        variant="rectangular"
        animation="wave"
        height={92}
        sx={{ borderRadius: "var(--joy-radius-lg)" }}
      />

      <Stack spacing={1}>
        <Skeleton variant="text" width={180} height={24} animation="wave" />
        <Skeleton variant="text" width={280} height={18} animation="wave" />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`share-${index}`} />
        ))}
      </Box>

      <Divider />

      <Stack spacing={1}>
        <Skeleton variant="text" width={200} height={24} animation="wave" />
        <Skeleton variant="text" width={340} height={18} animation="wave" />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`developer-${index}`} />
        ))}
      </Box>
    </Stack>
  );
}

function SkeletonCard() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2.5,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5}>
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            animation="wave"
          />
          <Stack spacing={0.4} sx={{ flex: 1 }}>
            <Skeleton variant="text" width={120} height={20} animation="wave" />
            <Skeleton variant="text" width="80%" height={18} animation="wave" />
          </Stack>
        </Stack>
        <Skeleton
          variant="rectangular"
          height={42}
          animation="wave"
          sx={{ borderRadius: "16px" }}
        />
        <Skeleton
          variant="rectangular"
          height={156}
          animation="wave"
          sx={{ borderRadius: "18px" }}
        />
      </Stack>
    </Sheet>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography level="title-md">{title}</Typography>
      {description ? (
        <Typography level="body-sm" color="neutral">
          {description}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ChannelCard({
  icon,
  title,
  description,
  children,
  headerActions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2.5,
      }}
    >
      <Stack spacing={2.25}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "flex-start" }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="flex-start"
            sx={{ minWidth: 0 }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "neutral.100",
                color: "neutral.600",
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Stack spacing={0.35} sx={{ minWidth: 0 }}>
              <Typography level="title-sm">{title}</Typography>
              <Typography level="body-sm" color="neutral">
                {description}
              </Typography>
            </Stack>
          </Stack>
          {headerActions}
        </Stack>
        {children}
      </Stack>
    </Sheet>
  );
}

function CodeSnippetBlock({
  code,
  copyLabel,
  copied,
  onCopy,
}: {
  code: string;
  copyLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Sheet
      variant="soft"
      sx={{
        position: "relative",
        bgcolor: "background.level1",
        borderRadius: "sm",
        p: 2,
        pt: 6,
        fontFamily: codeFontFamily,
        fontSize: "sm",
        overflow: "auto",
        maxHeight: 200,
      }}
    >
      <Button
        size="sm"
        variant={copied ? "soft" : "outlined"}
        color={copied ? "success" : "neutral"}
        startDecorator={copied ? <Check size={14} /> : <Copy size={14} />}
        onClick={onCopy}
        sx={{ position: "absolute", top: 12, right: 12 }}
      >
        {copied ? "Copied ✓" : copyLabel}
      </Button>
      <Box
        component="pre"
        sx={{
          m: 0,
          whiteSpace: "pre",
          color: "neutral.800",
          fontFamily: codeFontFamily,
        }}
      >
        {code}
      </Box>
    </Sheet>
  );
}

function ReadOnlyCodeInput({ value }: { value: string }) {
  return (
    <JoyInput
      readOnly
      value={value}
      variant="outlined"
      sx={{
        "& .MuiInput-input": {
          fontFamily: codeFontFamily,
          fontSize: "0.8125rem",
        },
      }}
    />
  );
}

export function FormPublishTab({
  analyticsSurface = "share-dialog",
  form,
  initialTab: _initialTab = "share-link",
  isActive = true,
  publishValidationIssues = [],
  onPublish,
  onUnpublish,
  isStatusUpdating = false,
}: FormPublishTabProps) {
  const [displayMode, setDisplayMode] =
    React.useState<FormEmbedDisplayMode>("inline");
  const [buttonText, setButtonText] = React.useState("Open Form");
  const [iframeHeight, setIframeHeight] = React.useState("600");
  const [qrCodeSvg, setQrCodeSvg] = React.useState("");
  const [qrCodePngUrl, setQrCodePngUrl] = React.useState("");
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const copyTimerRef = React.useRef<number | null>(null);
  const wasActiveRef = React.useRef(false);

  const isPublished = form.status === "published";
  const publicUrl = React.useMemo(
    () => getPublicFormUrl(form.embed_key),
    [form.embed_key],
  );
  const submitEndpoint = React.useMemo(
    () => getPublicFormSubmissionEndpoint(form.id),
    [form.id],
  );
  const documentationPath = React.useMemo(
    () => `/crm/forms/${form.id}/docs`,
    [form.id],
  );
  const iframeCode = React.useMemo(
    () =>
      buildIframeEmbedCode({
        embedKey: form.embed_key,
        iframeHeight: Math.max(320, Number(iframeHeight) || 600),
      }),
    [form.embed_key, iframeHeight],
  );
  const javascriptEmbedCode = React.useMemo(
    () =>
      buildJavaScriptEmbedCode({
        embedKey: form.embed_key,
        formName: form.name,
        displayMode,
        buttonText,
      }),
    [buttonText, displayMode, form.embed_key, form.name],
  );
  const developerSnippets = React.useMemo(
    () => ({
      curl: buildCurlSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
        fields: form.fields_json,
      }),
      react: buildReactSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
        fields: form.fields_json,
      }),
      nextjs: buildNextJsSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
        fields: form.fields_json,
      }),
    }),
    [form.embed_key, form.fields_json, form.id, form.name, submitEndpoint],
  );

  const markCopied = React.useCallback((key: string) => {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    setCopiedKey(key);
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
      copyTimerRef.current = null;
    }, 2000);
  }, []);

  const trackMethodSelected = React.useCallback(
    (method: ShareMethodKey, action: string) => {
      trackFormBuilderAnalyticsEvent("form_share_method_selected", {
        action,
        form_id: form.id,
        form_status: form.status,
        method,
        surface: analyticsSurface,
      });
    },
    [analyticsSurface, form.id, form.status],
  );

  const trackCopySuccess = React.useCallback(
    (method: ShareMethodKey, target: string) => {
      trackFormBuilderAnalyticsEvent("form_share_copy", {
        form_id: form.id,
        form_status: form.status,
        method,
        surface: analyticsSurface,
        target,
      });
    },
    [analyticsSurface, form.id, form.status],
  );

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsBootstrapping(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  React.useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      trackFormBuilderAnalyticsEvent("form_share_opened", {
        form_id: form.id,
        form_status: form.status,
        surface: analyticsSurface,
      });
    }

    wasActiveRef.current = isActive;
  }, [analyticsSurface, form.id, form.status, isActive]);

  React.useEffect(() => {
    let cancelled = false;

    void Promise.all([
      QRCode.toString(publicUrl, {
        type: "svg",
        width: 160,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }),
      QRCode.toDataURL(publicUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }),
    ])
      .then(([svgMarkup, pngDataUrl]) => {
        if (!cancelled) {
          setQrCodeSvg(svgMarkup);
          setQrCodePngUrl(pngDataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeSvg("");
          setQrCodePngUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyTextValue = React.useCallback(
    async ({
      key,
      label,
      method,
      target,
      value,
    }: {
      key: string;
      label: string;
      method: ShareMethodKey;
      target: string;
      value: string;
    }) => {
      trackMethodSelected(method, target);

      try {
        await navigator.clipboard.writeText(value);
        markCopied(key);
        toast.success(`${label} copied`);
        trackCopySuccess(method, target);
      } catch {
        toast.error(`Unable to copy ${label.toLowerCase()}`);
      }
    },
    [markCopied, trackCopySuccess, trackMethodSelected],
  );

  const handleDownloadQr = React.useCallback(() => {
    trackMethodSelected("qr_code", "download");

    if (!qrCodePngUrl) {
      toast.error("QR code is not ready yet.");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrCodePngUrl;
    anchor.download = `${slugify(form.name) || "bloomsuite-form"}-qr.png`;
    anchor.click();
  }, [form.name, qrCodePngUrl, trackMethodSelected]);

  const handleCopyQr = React.useCallback(async () => {
    trackMethodSelected("qr_code", "copy");

    if (!qrCodePngUrl) {
      toast.error("QR code is not ready yet.");
      return;
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      toast.error("QR image copy is not supported in this browser.");
      return;
    }

    try {
      const response = await fetch(qrCodePngUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      markCopied("copy-qr");
      toast.success("QR code copied");
      trackCopySuccess("qr_code", "qr_image");
    } catch {
      toast.error("Unable to copy the QR code");
    }
  }, [markCopied, qrCodePngUrl, trackCopySuccess, trackMethodSelected]);

  const handleOpenPublicUrl = React.useCallback(() => {
    trackMethodSelected("direct_link", "open");
  }, [trackMethodSelected]);

  const handleOpenDocs = React.useCallback(() => {
    trackMethodSelected("api_endpoint", "open_docs");
  }, [trackMethodSelected]);

  const shareGrid = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <ChannelCard
        icon={<Link2 size={20} />}
        title="Direct link"
        description="Share the hosted BloomSuite form URL with visitors."
      >
        <Stack spacing={1.25}>
          <ReadOnlyCodeInput value={publicUrl} />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              size="sm"
              variant={copiedKey === "direct-link" ? "soft" : "outlined"}
              color={copiedKey === "direct-link" ? "success" : "neutral"}
              startDecorator={
                copiedKey === "direct-link" ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )
              }
              onClick={() =>
                void copyTextValue({
                  key: "direct-link",
                  label: "Link",
                  method: "direct_link",
                  target: "public_url",
                  value: publicUrl,
                })
              }
            >
              {copiedKey === "direct-link" ? "Copied ✓" : "Copy link"}
            </Button>
            <IconButton
              size="sm"
              variant="outlined"
              color="neutral"
              component="a"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              onClick={handleOpenPublicUrl}
            >
              <ExternalLink size={16} />
            </IconButton>
          </Stack>
        </Stack>
      </ChannelCard>

      <ChannelCard
        icon={<QrCode size={20} />}
        title="QR code"
        description="Hand off a scannable share option for print, packaging, and in-store signage."
      >
        <Stack spacing={1.25} alignItems="flex-start">
          <Sheet
            variant="soft"
            sx={{
              width: 176,
              height: 176,
              borderRadius: "var(--joy-radius-lg)",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.level1",
            }}
          >
            {qrCodeSvg ? (
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  display: "grid",
                  placeItems: "center",
                  "& svg": { width: "100%", height: "100%" },
                }}
                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
              />
            ) : (
              <Typography level="body-sm" color="neutral">
                Generating QR…
              </Typography>
            )}
          </Sheet>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<Download size={14} />}
              onClick={handleDownloadQr}
            >
              Download QR
            </Button>
            <Button
              size="sm"
              variant={copiedKey === "copy-qr" ? "soft" : "outlined"}
              color={copiedKey === "copy-qr" ? "success" : "neutral"}
              startDecorator={
                copiedKey === "copy-qr" ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )
              }
              onClick={() => {
                void handleCopyQr();
              }}
            >
              {copiedKey === "copy-qr" ? "Copied ✓" : "Copy QR"}
            </Button>
          </Stack>
        </Stack>
      </ChannelCard>

      <ChannelCard
        icon={<Code2 size={20} />}
        title="JavaScript embed"
        description="Install the shared runtime and mount the form inside your site."
        headerActions={
          <JoyChip size="sm" variant="soft" color="neutral">
            Runtime v{STATIC_EMBED_RUNTIME_VERSION}
          </JoyChip>
        }
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "flex-start" }}
          >
            <JoySelect
              size="sm"
              label="Display mode"
              value={displayMode}
              options={DISPLAY_MODE_OPTIONS}
              onValueChange={(value) => {
                if (value) {
                  setDisplayMode(value as FormEmbedDisplayMode);
                }
              }}
              sx={{ minWidth: { sm: 180 } }}
            />
            {displayMode !== "inline" ? (
              <JoyInput
                size="sm"
                label="Button label"
                value={buttonText}
                onValueChange={setButtonText}
                sx={{ flex: 1 }}
              />
            ) : null}
          </Stack>
          <CodeSnippetBlock
            code={javascriptEmbedCode}
            copyLabel="Copy snippet"
            copied={copiedKey === "javascript-embed"}
            onCopy={() => {
              void copyTextValue({
                key: "javascript-embed",
                label: "JavaScript snippet",
                method: "javascript_embed",
                target: "embed_snippet",
                value: javascriptEmbedCode,
              });
            }}
          />
        </Stack>
      </ChannelCard>

      <ChannelCard
        icon={<Globe size={20} />}
        title="iFrame embed"
        description="Drop the hosted form into a simple iframe when you need isolation and quick setup."
      >
        <Stack spacing={1.25}>
          <JoyInput
            size="sm"
            label="iFrame height"
            value={iframeHeight}
            onValueChange={setIframeHeight}
            helperText="Responsive width is handled automatically. Increase the height for longer forms."
          />
          <CodeSnippetBlock
            code={iframeCode}
            copyLabel="Copy snippet"
            copied={copiedKey === "iframe-embed"}
            onCopy={() => {
              void copyTextValue({
                key: "iframe-embed",
                label: "iFrame snippet",
                method: "iframe_embed",
                target: "iframe_snippet",
                value: iframeCode,
              });
            }}
          />
          <Typography level="body-xs" color="neutral">
            The iframe stays width-responsive, but height must be managed on the
            host page to avoid internal scrolling.
          </Typography>
        </Stack>
      </ChannelCard>
    </Box>
  );

  const developerGrid = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <ChannelCard
        icon={<Server size={20} />}
        title="API endpoint"
        description="Post headless submissions to the published proxy route used by BloomSuite forms."
        headerActions={
          <JoyChip size="sm" variant="soft" color="primary">
            POST
          </JoyChip>
        }
      >
        <Stack spacing={1.25}>
          <ReadOnlyCodeInput value={submitEndpoint} />
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Button
              size="sm"
              variant={copiedKey === "api-endpoint" ? "soft" : "outlined"}
              color={copiedKey === "api-endpoint" ? "success" : "neutral"}
              startDecorator={
                copiedKey === "api-endpoint" ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )
              }
              onClick={() => {
                void copyTextValue({
                  key: "api-endpoint",
                  label: "Endpoint",
                  method: "api_endpoint",
                  target: "endpoint_url",
                  value: submitEndpoint,
                });
              }}
            >
              {copiedKey === "api-endpoint" ? "Copied ✓" : "Copy endpoint"}
            </Button>
            <Link
              component={RouterLink}
              to={documentationPath}
              level="body-sm"
              underline="hover"
              onClick={handleOpenDocs}
            >
              View full API docs{" "}
              <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </Link>
          </Stack>
        </Stack>
      </ChannelCard>

      <ChannelCard
        icon={<Terminal size={20} />}
        title="cURL"
        description="Test the submit pipeline from a shell or wire it into backend automation jobs."
      >
        <CodeSnippetBlock
          code={developerSnippets.curl}
          copyLabel="Copy cURL"
          copied={copiedKey === "curl"}
          onCopy={() => {
            void copyTextValue({
              key: "curl",
              label: "cURL snippet",
              method: "curl",
              target: "curl_snippet",
              value: developerSnippets.curl,
            });
          }}
        />
      </ChannelCard>

      <ChannelCard
        icon={<Code2 size={20} />}
        title="React component"
        description="Drop a client component into your app and post directly to the BloomSuite endpoint."
      >
        <Stack spacing={1.25}>
          <CodeSnippetBlock
            code={developerSnippets.react}
            copyLabel="Copy component"
            copied={copiedKey === "react-component"}
            onCopy={() => {
              void copyTextValue({
                key: "react-component",
                label: "React snippet",
                method: "react_component",
                target: "react_snippet",
                value: developerSnippets.react,
              });
            }}
          />
          <Typography level="body-xs" color="neutral">
            Uses the direct submission endpoint and does not require the shared
            runtime script.
          </Typography>
        </Stack>
      </ChannelCard>

      <ChannelCard
        icon={<BookOpen size={20} />}
        title="Next.js server action"
        description="Send submissions from a trusted server-side boundary when you want full control over the request lifecycle."
      >
        <Stack spacing={1.25}>
          <CodeSnippetBlock
            code={developerSnippets.nextjs}
            copyLabel="Copy snippet"
            copied={copiedKey === "nextjs"}
            onCopy={() => {
              void copyTextValue({
                key: "nextjs",
                label: "Next.js snippet",
                method: "nextjs_server_action",
                target: "nextjs_snippet",
                value: developerSnippets.nextjs,
              });
            }}
          />
          <Typography level="body-xs" color="neutral">
            Server-side submission bypasses browser CORS constraints and works
            well for server components and API routes.
          </Typography>
        </Stack>
      </ChannelCard>
    </Box>
  );

  if (isBootstrapping) {
    return <PublishLoadingState />;
  }

  return (
    <Stack spacing={3}>
      {isPublished ? (
        <Sheet
          variant="soft"
          color="success"
          sx={{ borderRadius: "var(--joy-radius-lg)", p: 2.25 }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography level="title-sm">
                Your form is live and accepting submissions
              </Typography>
              <Link
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                onClick={handleOpenPublicUrl}
              >
                {publicUrl}
              </Link>
            </Stack>
            <Button
              size="sm"
              variant="plain"
              color="success"
              loading={isStatusUpdating}
              onClick={() => {
                void onUnpublish?.();
              }}
            >
              Unpublish
            </Button>
          </Stack>
        </Sheet>
      ) : publishValidationIssues.length > 0 ? (
        <Sheet
          variant="soft"
          color="warning"
          sx={{ borderRadius: "var(--joy-radius-lg)", p: 2.25 }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.4}>
                <Typography level="title-sm">
                  This form is in draft mode and is not accepting public
                  submissions
                </Typography>
                <Typography level="body-sm">
                  Resolve the publish blockers below before taking the form
                  live.
                </Typography>
              </Stack>
              <Button
                size="sm"
                variant="solid"
                color="warning"
                loading={isStatusUpdating}
                onClick={() => {
                  void onPublish?.();
                }}
              >
                Publish
              </Button>
            </Stack>

            <Stack spacing={0.75}>
              {publishValidationIssues.map((issue) => (
                <Alert
                  key={issue.id}
                  size="sm"
                  color="warning"
                  variant="soft"
                  startDecorator={<AlertTriangle size={16} />}
                >
                  <Stack spacing={0.2}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {issue.description}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {issue.fixHint}
                    </Typography>
                  </Stack>
                </Alert>
              ))}
            </Stack>
          </Stack>
        </Sheet>
      ) : (
        <Sheet
          variant="soft"
          color="warning"
          sx={{ borderRadius: "var(--joy-radius-lg)", p: 2.25 }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.4}>
              <Typography level="title-sm">
                This form is in draft mode and not accepting public submissions
              </Typography>
              <Typography level="body-sm">
                Your share links and snippets are ready. Publish the form when
                you are ready to accept traffic.
              </Typography>
            </Stack>
            <Button
              size="sm"
              variant="solid"
              color="warning"
              loading={isStatusUpdating}
              onClick={() => {
                void onPublish?.();
              }}
            >
              Publish
            </Button>
          </Stack>
        </Sheet>
      )}

      <Stack spacing={1.25}>
        <SectionHeading title="Share your form" />
        {shareGrid}
      </Stack>

      <Divider />

      <Stack spacing={1.25}>
        <SectionHeading
          title="Developer integration"
          description="For custom integrations and headless form submissions"
        />
        {developerGrid}
      </Stack>
    </Stack>
  );
}
