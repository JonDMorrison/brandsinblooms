import * as React from "react";
import QRCode from "qrcode";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Braces,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import {
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

type ShareMethod = "share-link" | "embed-code" | "developer";
type DeveloperSnippetKey = "curl" | "react" | "nextjs";
type LegacyInitialTab =
  | ShareMethod
  | "direct-link"
  | "iframe"
  | "javascript"
  | "react";

type PublishTabAnalyticsSurface = "share-dialog" | "publish-success";

interface FormPublishTabProps {
  analyticsSurface?: PublishTabAnalyticsSurface;
  form: Pick<Form, "id" | "name" | "status" | "embed_key" | "fields_json">;
  initialTab?: LegacyInitialTab;
}

const SHARE_TABS: Array<{
  value: ShareMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "share-link",
    label: "Direct link",
    description: "Copy or open the hosted form URL.",
    icon: <Link2 size={16} />,
  },
  {
    value: "embed-code",
    label: "Embed code",
    description: "Inline, modal, or slide-in installs for websites.",
    icon: <Code2 size={16} />,
  },
  {
    value: "developer",
    label: "Developer",
    description: "Submit endpoints and implementation snippets.",
    icon: <Braces size={16} />,
  },
];

const DISPLAY_MODE_OPTIONS: Array<{
  value: FormEmbedDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: "inline",
    label: "Inline",
    description: "Render inside the page flow.",
  },
  {
    value: "modal",
    label: "Modal",
    description: "Open the form in a centered overlay.",
  },
  {
    value: "slide-in",
    label: "Slide-in",
    description: "Reveal from the side without taking over the page.",
  },
];

const DEVELOPER_SNIPPETS: Array<{
  key: DeveloperSnippetKey;
  label: string;
}> = [
  { key: "curl", label: "cURL" },
  { key: "react", label: "React" },
  { key: "nextjs", label: "Next.js" },
];

function normalizeInitialTab(initialTab: LegacyInitialTab): ShareMethod {
  if (initialTab === "iframe" || initialTab === "javascript") {
    return "embed-code";
  }

  if (initialTab === "react") {
    return "developer";
  }

  if (initialTab === "direct-link") {
    return "share-link";
  }

  return initialTab;
}

function CodePanel({
  title,
  description,
  code,
  onCopy,
}: {
  title: string;
  description: string;
  code: string;
  onCopy: () => void;
}) {
  return (
    <JoyCard>
      <JoyCardHeader
        title={title}
        description={description}
        actions={
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            startDecorator={<Copy size={16} />}
            onClick={onCopy}
          >
            Copy
          </JoyButton>
        }
      />
      <JoyCardContent sx={{ pt: 2 }}>
        <Sheet
          component="pre"
          variant="soft"
          sx={{
            m: 0,
            p: 2,
            borderRadius: "lg",
            overflowX: "auto",
            fontFamily: "var(--joy-fontFamily-code)",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {code}
        </Sheet>
      </JoyCardContent>
    </JoyCard>
  );
}

export function FormPublishTab({
  analyticsSurface: _analyticsSurface = "share-dialog",
  form,
  initialTab = "share-link",
}: FormPublishTabProps) {
  const [activeTab, setActiveTab] = React.useState<ShareMethod>(
    normalizeInitialTab(initialTab),
  );
  const [displayMode, setDisplayMode] =
    React.useState<FormEmbedDisplayMode>("inline");
  const [buttonText, setButtonText] = React.useState("Open Form");
  const [iframeHeight, setIframeHeight] = React.useState("600");
  const [developerSnippet, setDeveloperSnippet] =
    React.useState<DeveloperSnippetKey>("curl");
  const [qrCodeSvg, setQrCodeSvg] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);

  const isPublished = form.status === "published";
  const publicUrl = React.useMemo(
    () => getPublicFormUrl(form.embed_key),
    [form.embed_key],
  );
  const submitEndpoint = React.useMemo(
    () => getPublicFormSubmissionEndpoint(form.id),
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
  const embedCode = React.useMemo(
    () =>
      buildJavaScriptEmbedCode({
        embedKey: form.embed_key,
        formName: form.name,
        displayMode,
        buttonText,
      }),
    [buttonText, displayMode, form.embed_key, form.name],
  );
  const developerCodes = React.useMemo(
    () => ({
      curl: buildCurlSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
      }),
      react: buildReactSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
      }),
      nextjs: buildNextJsSubmissionSnippet({
        embedKey: form.embed_key,
        endpoint: submitEndpoint,
        formId: form.id,
        formName: form.name,
      }),
    }),
    [form.embed_key, form.id, form.name, submitEndpoint],
  );

  React.useEffect(() => {
    if (!showQr) {
      return;
    }

    let cancelled = false;

    void QRCode.toString(publicUrl, {
      type: "svg",
      width: 180,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((svgMarkup) => {
        if (!cancelled) {
          setQrCodeSvg(svgMarkup);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeSvg("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl, showQr]);

  const copyValue = React.useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  }, []);

  return (
    <Stack spacing={3}>
      {!isPublished ? (
        <Sheet variant="soft" color="warning" sx={{ borderRadius: "lg", p: 2 }}>
          <Stack spacing={0.75}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Publish the form before sharing it externally.
            </Typography>
            <Typography level="body-sm">
              The hosted URL and embed snippets are ready, but the public
              runtime only resolves while the form is published.
            </Typography>
          </Stack>
        </Sheet>
      ) : null}

      <JoyTabs
        value={activeTab}
        onValueChange={(value) => value && setActiveTab(value as ShareMethod)}
      >
        <JoyTabsList
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          {SHARE_TABS.map((tab) => (
            <JoyTabsTrigger
              key={tab.value}
              value={tab.value}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                minWidth: 0,
                gap: 0.5,
                textAlign: "left",
                py: 1.5,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {tab.icon}
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {tab.label}
                </Typography>
              </Stack>
              <Typography level="body-xs" color="neutral">
                {tab.description}
              </Typography>
            </JoyTabsTrigger>
          ))}
        </JoyTabsList>

        <JoyTabsContent value="share-link">
          <Stack spacing={2}>
            <JoyCard>
              <JoyCardHeader
                startDecorator={
                  <Avatar size="sm" variant="soft" color="primary">
                    <Globe size={18} />
                  </Avatar>
                }
                title="Hosted form URL"
                description="Use the direct link when you want the form to live on its own page."
                actions={
                  <JoyChip
                    size="sm"
                    variant="soft"
                    color={isPublished ? "success" : "warning"}
                  >
                    {isPublished ? "Live" : "Draft"}
                  </JoyChip>
                }
              />
              <JoyCardContent sx={{ pt: 3, gap: 2 }}>
                <JoyInput label="Public URL" value={publicUrl} readOnly />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <JoyButton
                    startDecorator={<Copy size={16} />}
                    onClick={() => void copyValue("Public URL", publicUrl)}
                  >
                    Copy URL
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<ExternalLink size={16} />}
                    component="a"
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open hosted form
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    startDecorator={<QrCode size={16} />}
                    onClick={() => setShowQr((value) => !value)}
                  >
                    {showQr ? "Hide QR" : "Show QR"}
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>

            {showQr ? (
              <JoyCard>
                <JoyCardHeader
                  title="QR code"
                  description="Useful for in-store signage, event booths, and print collateral."
                />
                <JoyCardContent sx={{ pt: 2, alignItems: "center" }}>
                  <Sheet
                    variant="soft"
                    sx={{
                      p: 2,
                      borderRadius: "lg",
                      minHeight: 220,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {qrCodeSvg ? (
                      <Box
                        sx={{
                          width: 180,
                          height: 180,
                          display: "grid",
                          placeItems: "center",
                          "& svg": { width: "100%", height: "100%" },
                        }}
                        dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                      />
                    ) : (
                      <Typography level="body-sm" color="neutral">
                        Generating QR code...
                      </Typography>
                    )}
                  </Sheet>
                </JoyCardContent>
              </JoyCard>
            ) : null}
          </Stack>
        </JoyTabsContent>

        <JoyTabsContent value="embed-code">
          <Stack spacing={2}>
            <JoyCard>
              <JoyCardHeader
                startDecorator={
                  <Avatar size="sm" variant="soft" color="primary">
                    <Code2 size={18} />
                  </Avatar>
                }
                title="JavaScript embed"
                description="Install the shared runtime and choose how the form should appear on your site."
              />
              <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  {DISPLAY_MODE_OPTIONS.map((option) => {
                    const selected = displayMode === option.value;
                    return (
                      <Sheet
                        key={option.value}
                        variant={selected ? "soft" : "plain"}
                        color={selected ? "primary" : "neutral"}
                        onClick={() => setDisplayMode(option.value)}
                        sx={{
                          borderRadius: "lg",
                          border: "1px solid",
                          borderColor: selected ? "primary.300" : "neutral.200",
                          px: 2,
                          py: 1.5,
                          cursor: "pointer",
                        }}
                      >
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {option.label}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {option.description}
                          </Typography>
                        </Stack>
                      </Sheet>
                    );
                  })}
                </Box>

                {displayMode !== "inline" ? (
                  <JoyInput
                    label="Trigger button label"
                    value={buttonText}
                    onValueChange={setButtonText}
                  />
                ) : null}

                <CodePanel
                  title="Embed snippet"
                  description="Paste this into the page where the form should appear."
                  code={embedCode}
                  onCopy={() => void copyValue("Embed code", embedCode)}
                />
              </JoyCardContent>
            </JoyCard>

            <JoyCard>
              <JoyCardHeader
                title="Iframe fallback"
                description="Useful when you need a fast, isolated embed without the runtime script."
              />
              <JoyCardContent sx={{ pt: 3, gap: 2 }}>
                <FormControl>
                  <FormLabel>Iframe height</FormLabel>
                  <JoyInput
                    value={iframeHeight}
                    onValueChange={setIframeHeight}
                  />
                  <FormHelperText>
                    Minimum 320px. Increase this for longer forms.
                  </FormHelperText>
                </FormControl>
                <CodePanel
                  title="Iframe snippet"
                  description="A simple hosted iframe pointing at the public form route."
                  code={iframeCode}
                  onCopy={() => void copyValue("Iframe code", iframeCode)}
                />
              </JoyCardContent>
            </JoyCard>
          </Stack>
        </JoyTabsContent>

        <JoyTabsContent value="developer">
          <Stack spacing={2}>
            <JoyCard>
              <JoyCardHeader
                startDecorator={
                  <Avatar size="sm" variant="soft" color="neutral">
                    <Braces size={18} />
                  </Avatar>
                }
                title="Submission endpoint"
                description="Use the public submit route when you want to post data from a custom UI."
              />
              <JoyCardContent sx={{ pt: 3, gap: 2 }}>
                <JoyInput
                  label="POST endpoint"
                  value={submitEndpoint}
                  readOnly
                />
                <Stack direction="row" spacing={1}>
                  <JoyButton
                    startDecorator={<Copy size={16} />}
                    onClick={() => void copyValue("Endpoint", submitEndpoint)}
                  >
                    Copy endpoint
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>

            <JoyTabs
              value={developerSnippet}
              onValueChange={(value) =>
                value && setDeveloperSnippet(value as DeveloperSnippetKey)
              }
            >
              <JoyTabsList
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))" },
                }}
              >
                {DEVELOPER_SNIPPETS.map((snippet) => (
                  <JoyTabsTrigger
                    key={snippet.key}
                    value={snippet.key}
                    sx={{ justifyContent: "center" }}
                  >
                    {snippet.label}
                  </JoyTabsTrigger>
                ))}
              </JoyTabsList>
              <JoyTabsContent value="curl">
                <CodePanel
                  title="cURL request"
                  description="Quickly test the submit pipeline from a terminal or backend job."
                  code={developerCodes.curl}
                  onCopy={() =>
                    void copyValue("cURL snippet", developerCodes.curl)
                  }
                />
              </JoyTabsContent>
              <JoyTabsContent value="react">
                <CodePanel
                  title="React example"
                  description="A minimal client-side form wired to the submission endpoint."
                  code={developerCodes.react}
                  onCopy={() =>
                    void copyValue("React snippet", developerCodes.react)
                  }
                />
              </JoyTabsContent>
              <JoyTabsContent value="nextjs">
                <CodePanel
                  title="Next.js example"
                  description="Use a small API route as a proxy between the browser and the form submission endpoint."
                  code={developerCodes.nextjs}
                  onCopy={() =>
                    void copyValue("Next.js snippet", developerCodes.nextjs)
                  }
                />
              </JoyTabsContent>
            </JoyTabs>
          </Stack>
        </JoyTabsContent>
      </JoyTabs>
    </Stack>
  );
}
