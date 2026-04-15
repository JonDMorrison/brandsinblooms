import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bot,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Lightbulb,
  Loader2,
  Link2,
  Mail,
  MessageCircle,
  QrCode,
  Sparkles,
} from "lucide-react";

import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { CopyButton } from "@/components/ui-legacy/copy-button";
import { Input } from "@/components/ui-legacy/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import {
  useCopyFeedback,
  type CopyFeedbackState,
} from "@/hooks/useCopyFeedback";
import { useToast } from "@/hooks/use-toast";
import { trackFormBuilderAnalyticsEvent } from "@/lib/forms/analytics";
import {
  getCanonicalFormDocumentationPath,
  type MinimalForm,
} from "@/lib/forms/documentation";
import { buildFormMarkdownForAI } from "@/lib/forms/markdown-generator";
import {
  buildCurlSubmissionSnippet,
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildNextJsSubmissionSnippet,
  buildReactSubmissionSnippet,
  FormEmbedDisplayMode,
  getPublicFormSubmissionEndpoint,
  getPublicFormUrl,
} from "@/lib/forms/share";
import { cn } from "@/lib/utils";

type ShareMethod = "share-link" | "embed-code" | "developer";
type LegacyInitialTab =
  | ShareMethod
  | "direct-link"
  | "iframe"
  | "javascript"
  | "react";
type DeveloperSnippetKey = "curl" | "react" | "nextjs";
type CodeLanguage = "bash" | "html" | "tsx";
type PublishTabAnalyticsSurface = "share-dialog" | "publish-success";
type QrCodeStatus = "idle" | "loading" | "ready" | "error";

interface FormPublishTabProps {
  analyticsSurface?: PublishTabAnalyticsSurface;
  form: MinimalForm;
  initialTab?: LegacyInitialTab;
}

const PANEL_CLASS =
  "space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70";

const SHARE_METHODS: Array<{
  value: ShareMethod;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "share-link",
    title: "Share Link",
    description: "Copy a link and send it anywhere in seconds.",
    icon: Link2,
  },
  {
    value: "embed-code",
    title: "Embed Code",
    description: "Add the form to your website with a polished embed.",
    icon: Code2,
  },
  {
    value: "developer",
    title: "Developer Integration",
    description:
      "Live submit snippets, docs, and AI-ready implementation copy.",
    icon: Braces,
  },
];

const DISPLAY_MODE_OPTIONS: Array<{
  value: FormEmbedDisplayMode;
  title: string;
  description: string;
  helper: string;
}> = [
  {
    value: "inline",
    title: "Inline",
    description: "Shows in the natural page flow.",
    helper: "Best when the form should feel like part of the page.",
  },
  {
    value: "modal",
    title: "Modal",
    description: "Opens as a centered popup.",
    helper: "Great for campaigns, landing pages, and focused actions.",
  },
  {
    value: "slide-in",
    title: "Slide-in",
    description: "Slides in from the edge.",
    helper: "Good for keeping the page visible while inviting action.",
  },
];

const DEVELOPER_SNIPPETS: Array<{
  key: DeveloperSnippetKey;
  title: string;
  description: string;
  language: CodeLanguage;
}> = [
  {
    key: "curl",
    title: "cURL",
    description: "Send a form submission from any backend or terminal.",
    language: "bash",
  },
  {
    key: "react",
    title: "React",
    description: "A lightweight client-side submit example.",
    language: "tsx",
  },
  {
    key: "nextjs",
    title: "Next.js",
    description: "A simple proxy route and form starter.",
    language: "tsx",
  },
];

function isShareMethod(value: string): value is ShareMethod {
  return SHARE_METHODS.some((method) => method.value === value);
}

function isDeveloperSnippetKey(value: string): value is DeveloperSnippetKey {
  return DEVELOPER_SNIPPETS.some((snippet) => snippet.key === value);
}

export function FormPublishTab({
  analyticsSurface = "share-dialog",
  form,
  initialTab = "share-link",
}: FormPublishTabProps) {
  const { toast } = useToast();
  const { copyValue, getCopyState } = useCopyFeedback();
  const [activeMethod, setActiveMethod] = useState<ShareMethod>(
    normalizeInitialMethod(initialTab),
  );
  const [displayMode, setDisplayMode] =
    useState<FormEmbedDisplayMode>("inline");
  const [buttonText, setButtonText] = useState("Open Form");
  const [iframeHeight, setIframeHeight] = useState("600");
  const [showIframeOption, setShowIframeOption] = useState(false);
  const [activeDeveloperSnippet, setActiveDeveloperSnippet] =
    useState<DeveloperSnippetKey>("curl");
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [qrCodeStatus, setQrCodeStatus] = useState<QrCodeStatus>("idle");
  const [qrCodeSvgMarkup, setQrCodeSvgMarkup] = useState("");
  const [qrCodePngDataUrl, setQrCodePngDataUrl] = useState("");

  const isDraft = form.status !== "published";
  const isEmptyForm = form.fields_json.length === 0;

  const publicUrl = useMemo(
    () => getPublicFormUrl(form.embed_key),
    [form.embed_key],
  );
  const submitEndpoint = useMemo(
    () => getPublicFormSubmissionEndpoint(form.id),
    [form.id],
  );
  const aiMarkdown = useMemo(() => buildFormMarkdownForAI(form), [form]);
  const normalizedIframeHeight = Math.max(320, Number(iframeHeight) || 600);
  const developerDocsPath = useMemo(
    () => getCanonicalFormDocumentationPath(form.id),
    [form.id],
  );

  const smartEmbedCode = useMemo(
    () =>
      buildJavaScriptEmbedCode({
        embedKey: form.embed_key,
        formName: form.name,
        displayMode,
        buttonText,
      }),
    [buttonText, displayMode, form.embed_key, form.name],
  );

  const iframeCode = useMemo(
    () =>
      buildIframeEmbedCode({
        embedKey: form.embed_key,
        iframeHeight: normalizedIframeHeight,
      }),
    [form.embed_key, normalizedIframeHeight],
  );

  const developerSnippets = useMemo(
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

  const socialCopy = useMemo(
    () => `📝 Fill out ${form.name}: ${publicUrl}`,
    [form.name, publicUrl],
  );
  const compactPublicUrl = useMemo(
    () => formatPublicUrlForDisplay(publicUrl),
    [publicUrl],
  );
  const qrDownloadBaseName = useMemo(
    () => buildQrDownloadFileBaseName(form.name),
    [form.name],
  );
  const emailShareHref = useMemo(
    () =>
      `mailto:?subject=${encodeURIComponent("Check out this form")}&body=${encodeURIComponent(
        `Fill out this form: ${publicUrl}`,
      )}`,
    [publicUrl],
  );

  useEffect(() => {
    setShowQrPreview(false);
    setQrCodeStatus("idle");
    setQrCodeSvgMarkup("");
    setQrCodePngDataUrl("");
  }, [publicUrl]);

  useEffect(() => {
    if (!showQrPreview || qrCodeStatus === "ready") {
      return;
    }

    let cancelled = false;
    setQrCodeStatus("loading");

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
        width: 320,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }),
    ])
      .then(([svgMarkup, pngDataUrl]) => {
        if (cancelled) {
          return;
        }

        setQrCodeSvgMarkup(svgMarkup);
        setQrCodePngDataUrl(pngDataUrl);
        setQrCodeStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setQrCodeStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl, qrCodeStatus, showQrPreview]);

  const copyToClipboard = async ({
    description,
    key,
    target,
    value,
  }: {
    description: string;
    key: string;
    target: string;
    value: string;
  }) => {
    await copyValue({
      key,
      onSuccess: () => {
        toast({
          title: "Copied",
          description,
        });

        trackFormBuilderAnalyticsEvent("form_share_copy", {
          form_id: form.id,
          form_status: form.status,
          method: activeMethod,
          surface: analyticsSurface,
          target,
        });
      },
      onError: () => {
        toast({
          title: "Copy failed",
          description: "Please copy the value manually.",
        });
      },
      value,
    });
  };

  const handleMethodChange = (nextValue: string) => {
    if (!isShareMethod(nextValue)) {
      return;
    }

    setActiveMethod(nextValue);
    trackFormBuilderAnalyticsEvent("form_share_method_selected", {
      form_id: form.id,
      form_status: form.status,
      method: nextValue,
      surface: analyticsSurface,
    });
  };

  const handleDeveloperSnippetChange = (nextValue: string) => {
    if (!isDeveloperSnippetKey(nextValue)) {
      return;
    }

    setActiveDeveloperSnippet(nextValue);
  };

  return (
    <div className="mx-auto max-w-[680px] space-y-6">
      {isDraft || isEmptyForm ? (
        <div className="space-y-3">
          {isDraft ? (
            <SurfaceNotice
              description="Share links, embeds, and the public submit endpoint stay visible here for implementation work, but live public requests return a 404 response until the form is published."
              icon={AlertCircle}
              tone="warning"
              title="This form is still a draft"
            />
          ) : null}

          {isEmptyForm ? (
            <SurfaceNotice
              description="The developer snippets still show the live endpoint and metadata contract, but payload examples stay intentionally minimal until fields are added in the builder."
              icon={Lightbulb}
              tone="info"
              title="No form fields are configured yet"
            />
          ) : null}
        </div>
      ) : null}

      <Tabs
        value={activeMethod}
        onValueChange={handleMethodChange}
        className="space-y-6"
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-3 rounded-none bg-transparent p-0 md:grid-cols-3">
          {SHARE_METHODS.map((method) => {
            const Icon = method.icon;

            return (
              <TabsTrigger
                key={method.value}
                value={method.value}
                className={cn(
                  "group h-auto w-full min-w-0 flex-col items-start justify-start whitespace-normal rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50",
                  "data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-50 data-[state=active]:shadow-sm",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-emerald-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-4 block w-full min-w-0 space-y-1">
                  <span className="block text-sm font-semibold text-slate-950">
                    {method.title}
                  </span>
                  <span className="block text-sm leading-6 text-slate-500">
                    {method.description}
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent
          value="share-link"
          className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <section className={cn(PANEL_CLASS, "space-y-4")}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-950">
                  Your Form Link
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                Share this link with anyone. It stays the same even when you
                update the form.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
              <div className="flex flex-col sm:flex-row">
                <div className="min-w-0 flex-1 bg-slate-50 px-4 py-3">
                  <p
                    data-testid="public-link-display"
                    title={publicUrl}
                    className="truncate font-mono text-sm text-slate-700"
                  >
                    {compactPublicUrl}
                  </p>
                </div>

                <PrimaryShareActionButton
                  ariaLabel="Copy public form link"
                  idleIcon={Copy}
                  idleLabel="Copy"
                  onClick={() =>
                    void copyToClipboard({
                      value: publicUrl,
                      key: "public-link",
                      target: "public-link",
                      description:
                        "The form link was copied to your clipboard.",
                    })
                  }
                  state={getCopyState("public-link")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ShareShortcutCard
                href={emailShareHref}
                icon={Mail}
                title="Email"
                description="Open email client with the link"
              />

              <ShareShortcutCard
                ariaLabel="Copy social share message"
                icon={MessageCircle}
                title="Social"
                description={
                  getCopyState("social-link") === "success"
                    ? "Copied! Paste it anywhere"
                    : "Copy a ready-made share message"
                }
                isActive={getCopyState("social-link") === "success"}
                onClick={() =>
                  void copyToClipboard({
                    value: socialCopy,
                    key: "social-link",
                    target: "social-message",
                    description:
                      "A social-ready version of the form link was copied.",
                  })
                }
              />

              <ShareShortcutCard
                ariaLabel={showQrPreview ? "Hide QR code" : "Show QR code"}
                icon={QrCode}
                title="QR Code"
                description={
                  showQrPreview
                    ? "Hide the QR preview"
                    : "Scan to open the form"
                }
                isActive={showQrPreview}
                onClick={() => setShowQrPreview((current) => !current)}
              />
            </div>

            {showQrPreview ? (
              <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
                {qrCodeStatus === "loading" ? (
                  <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-5 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    Generating QR code...
                  </div>
                ) : qrCodeStatus === "error" ? (
                  <div className="space-y-3 rounded-xl bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      QR code unavailable right now
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      Try generating it again. The share link itself is still
                      ready to use.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-200 bg-white hover:bg-slate-50"
                      onClick={() => {
                        setQrCodeStatus("idle");
                        setQrCodeSvgMarkup("");
                        setQrCodePngDataUrl("");
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[176px_minmax(0,1fr)] lg:items-center">
                    <div className="flex h-[176px] w-[176px] items-center justify-center rounded-[1.25rem] bg-white p-4 shadow-sm shadow-slate-900/5">
                      <div
                        className="h-40 w-40"
                        aria-label="QR code for public form link"
                        dangerouslySetInnerHTML={{
                          __html: qrCodeSvgMarkup,
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          Scan this code to open the form
                        </p>
                        <p className="text-sm leading-6 text-slate-500">
                          Share it in print, on packaging, or anywhere someone
                          should be able to open the form on a mobile device.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 whitespace-normal rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            downloadQrDataUrl(
                              qrCodePngDataUrl,
                              `${qrDownloadBaseName}.png`,
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          Download PNG
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 whitespace-normal rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            downloadQrSvg(
                              qrCodeSvgMarkup,
                              `${qrDownloadBaseName}.svg`,
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          Download SVG
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />
              <span>Responses flow into your dashboard automatically.</span>
            </div>
          </section>
        </TabsContent>

        <TabsContent
          value="embed-code"
          className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <section className={PANEL_CLASS}>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-950">
                Choose how the form appears on your website
              </h3>
              <p className="text-sm leading-6 text-slate-500">
                Pick the experience your visitors should see. The code updates
                automatically as you change the display style.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Display style
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {DISPLAY_MODE_OPTIONS.map((option) => (
                  <DisplayModeCard
                    key={option.value}
                    description={option.description}
                    helper={option.helper}
                    isActive={displayMode === option.value}
                    mode={option.value}
                    onSelect={() => setDisplayMode(option.value)}
                    title={option.title}
                  />
                ))}
              </div>
            </div>

            {displayMode === "inline" ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Inline embeds are ready to paste as-is
                </p>
                <p className="text-sm leading-6 text-slate-500">
                  We generate the placeholder container for you, so there is no
                  extra setup to worry about.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor="embed-button-text"
                  className="text-sm font-semibold text-slate-900"
                >
                  Button text
                </label>
                <Input
                  id="embed-button-text"
                  value={buttonText}
                  onChange={(event) => setButtonText(event.target.value)}
                  placeholder="Open Form"
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            )}

            <MiniEmbedPreview
              buttonText={buttonText}
              displayMode={displayMode}
              formName={form.name}
            />

            <DocCodeBlock
              ariaLabel="Embed code"
              code={smartEmbedCode}
              copyAriaLabel="Copy embed code"
              copyState={getCopyState("smart-embed")}
              description="Paste this snippet where you want the form to appear in your site’s HTML."
              language="html"
              onCopy={() =>
                copyToClipboard({
                  value: smartEmbedCode,
                  key: "smart-embed",
                  target: "embed-code",
                  description: "The embed code was copied to your clipboard.",
                })
              }
              testId="embed-code-block"
              title="Embed code"
            />

            <SurfaceNotice
              description="Use Inline when the form should live inside a page section, or choose Modal / Slide-in when you want the form to open on demand."
              icon={Lightbulb}
              title="Tip"
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                aria-controls="classic-iframe-option"
                aria-expanded={showIframeOption}
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowIframeOption((current) => !current)}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Need a classic iframe instead?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    It is still available for website builders that prefer a
                    single iframe snippet.
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-transform duration-200",
                    showIframeOption ? "rotate-90" : "rotate-0",
                  )}
                />
              </button>

              {showIframeOption ? (
                <div
                  id="classic-iframe-option"
                  className="mt-4 space-y-4 border-t border-slate-200 pt-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="iframe-height"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Iframe height
                    </label>
                    <Input
                      id="iframe-height"
                      min={320}
                      type="number"
                      value={iframeHeight}
                      onChange={(event) => setIframeHeight(event.target.value)}
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>

                  <DocCodeBlock
                    ariaLabel="Iframe embed code"
                    code={iframeCode}
                    copyAriaLabel="Copy iframe embed code"
                    copyState={getCopyState("iframe-embed")}
                    description="Use this when your website builder prefers an iframe over a script tag."
                    language="html"
                    onCopy={() =>
                      copyToClipboard({
                        value: iframeCode,
                        key: "iframe-embed",
                        target: "iframe-code",
                        description:
                          "The iframe code was copied to your clipboard.",
                      })
                    }
                    title="Iframe code"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent
          value="developer"
          className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <section className={PANEL_CLASS}>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-950">
                Integrate with your development workflow
              </h3>
              <p className="text-sm leading-6 text-slate-500">
                Use the live contract for direct submissions, custom app flows,
                or development handoff. The quick copies below use the real form
                ID and BloomSuite-hosted submit endpoint for this exact form.
              </p>
            </div>

            <div className="space-y-4">
              <CopyFieldRow
                copyAriaLabel="Copy form ID"
                copyState={getCopyState("form-id")}
                label="Form ID"
                onCopy={() =>
                  void copyToClipboard({
                    value: form.id,
                    key: "form-id",
                    target: "form-id",
                    description:
                      "The internal form ID was copied to your clipboard.",
                  })
                }
                value={form.id}
              />

              <CopyFieldRow
                copyAriaLabel="Copy embed key"
                copyState={getCopyState("embed-key")}
                helper="Use this for hosted form URLs and embed runtime setup. New direct submissions should post to the BloomSuite endpoint above instead."
                label="Embed key"
                onCopy={() =>
                  void copyToClipboard({
                    value: form.embed_key,
                    key: "embed-key",
                    target: "embed-key",
                    description:
                      "The public embed key was copied to your clipboard.",
                  })
                }
                value={form.embed_key}
              />

              <CopyFieldRow
                copyAriaLabel="Copy public submission endpoint"
                copyState={getCopyState("submit-endpoint")}
                label="Submission endpoint"
                onCopy={() =>
                  void copyToClipboard({
                    value: submitEndpoint,
                    key: "submit-endpoint",
                    target: "submission-endpoint",
                    description:
                      "The submission endpoint was copied to your clipboard.",
                  })
                }
                value={submitEndpoint}
              />
            </div>

            <Button
              asChild
              variant="outline"
              className="h-auto w-full min-w-0 items-start justify-start whitespace-normal rounded-2xl border-slate-200 bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"
            >
              <Link to={developerDocsPath} target="_blank" rel="noreferrer">
                <div className="flex w-full min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
                      Open Full Developer Documentation
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="break-words text-sm leading-6 text-slate-500">
                      Open the live per-form guide for current payload keys,
                      starter examples, response semantics, and event flow.
                    </p>
                  </div>
                </div>
              </Link>
            </Button>

            <Tabs
              value={activeDeveloperSnippet}
              onValueChange={handleDeveloperSnippetChange}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Starter snippets
                </p>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-500"
                >
                  Live contract
                </Badge>
              </div>

              <TabsList className="grid h-auto w-full grid-cols-1 gap-3 rounded-none bg-transparent p-0 sm:grid-cols-3">
                {DEVELOPER_SNIPPETS.map((snippet) => (
                  <TabsTrigger
                    key={snippet.key}
                    value={snippet.key}
                    className="h-auto w-full min-w-0 flex-col items-start justify-start whitespace-normal rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-50 data-[state=active]:shadow-sm"
                  >
                    <span className="block w-full min-w-0 space-y-1">
                      <span className="block text-sm font-semibold text-slate-950">
                        {snippet.title}
                      </span>
                      <span className="block text-sm leading-6 text-slate-500">
                        {snippet.description}
                      </span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {DEVELOPER_SNIPPETS.map((snippet) => (
                <TabsContent
                  key={snippet.key}
                  value={snippet.key}
                  className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
                >
                  <DocCodeBlock
                    ariaLabel={`${snippet.title} starter`}
                    code={developerSnippets[snippet.key]}
                    copyAriaLabel={`Copy ${snippet.title} starter`}
                    copyState={getCopyState(`developer-preview-${snippet.key}`)}
                    description={snippet.description}
                    language={snippet.language}
                    onCopy={() =>
                      copyToClipboard({
                        value: developerSnippets[snippet.key],
                        key: `developer-preview-${snippet.key}`,
                        target: `developer-${snippet.key}`,
                        description: `${snippet.title} starter copied to your clipboard.`,
                      })
                    }
                    title={`${snippet.title} starter`}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
                      Copy as Markdown for AI Coding Agents
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-white text-[11px] text-slate-500"
                      >
                        For AI Training & Integration Purposes
                      </Badge>
                    </div>
                    <p className="break-words text-sm leading-6 text-slate-500">
                      Copies a purpose-built Markdown spec with live fields,
                      public endpoint details, Zod schema, starter snippets, and
                      response examples for AI-assisted implementation.
                    </p>
                  </div>
                </div>

                <CopyButton
                  aria-label="Copy AI integration markdown"
                  className="w-full sm:w-[8.75rem]"
                  onClick={() =>
                    void copyToClipboard({
                      value: aiMarkdown,
                      key: "developer-ai-markdown",
                      target: "ai-markdown",
                      description:
                        "AI integration markdown copied to your clipboard.",
                    })
                  }
                  state={getCopyState("developer-ai-markdown")}
                />
              </div>
            </div>

            <SurfaceNotice
              description="The internal form ID selects the public BloomSuite submit route. The embed key remains useful for hosted links and embed runtime setup."
              icon={Sparkles}
              title="Good to know"
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function normalizeInitialMethod(initialTab: LegacyInitialTab): ShareMethod {
  switch (initialTab) {
    case "iframe":
    case "javascript":
      return "embed-code";
    case "react":
      return "developer";
    case "direct-link":
    case "share-link":
    default:
      return "share-link";
  }
}

function DisplayModeCard({
  description,
  helper,
  isActive,
  mode,
  onSelect,
  title,
}: {
  description: string;
  helper: string;
  isActive: boolean;
  mode: FormEmbedDisplayMode;
  onSelect: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-all duration-200",
        isActive
          ? "border-emerald-500 bg-emerald-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <DisplayModeIllustration mode={mode} />
      <div className="mt-4 space-y-1">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
        <p className="text-xs leading-5 text-slate-400">{helper}</p>
      </div>
    </button>
  );
}

function DisplayModeIllustration({ mode }: { mode: FormEmbedDisplayMode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="h-2 w-1/3 rounded-full bg-slate-200" />
        <div className="h-2 w-full rounded-full bg-slate-100" />
        <div className="h-2 w-5/6 rounded-full bg-slate-100" />
        {mode === "inline" ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-8 rounded-lg bg-slate-100" />
            <div className="h-8 rounded-lg bg-slate-100" />
            <div className="h-8 rounded-lg bg-emerald-500/80" />
          </div>
        ) : mode === "modal" ? (
          <div className="relative h-24 rounded-xl bg-slate-100">
            <div className="absolute inset-3 rounded-lg border border-slate-300 bg-white/80" />
            <div className="absolute left-1/2 top-1/2 h-12 w-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-md" />
          </div>
        ) : (
          <div className="relative h-24 rounded-xl bg-slate-100">
            <div className="absolute inset-y-2 right-2 w-16 rounded-lg border border-slate-200 bg-white shadow-md" />
            <div className="absolute bottom-3 left-3 h-8 w-20 rounded-full bg-emerald-500/80" />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniEmbedPreview({
  buttonText,
  displayMode,
  formName,
}: {
  buttonText: string;
  displayMode: FormEmbedDisplayMode;
  formName: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Preview</p>
          <p className="text-sm text-slate-500">
            A quick look at the visitor experience.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700"
        >
          {displayMode === "slide-in"
            ? "Slide-in"
            : displayMode === "modal"
              ? "Modal"
              : "Inline"}
        </Badge>
      </div>

      <div className="p-4">
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
          {displayMode === "inline" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">{formName}</p>
              <div className="mt-4 space-y-2">
                <div className="h-9 rounded-xl bg-slate-100" />
                <div className="h-9 rounded-xl bg-slate-100" />
                <div className="h-10 rounded-xl bg-emerald-500/85" />
              </div>
            </div>
          ) : displayMode === "modal" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-center">
                <div className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                  {buttonText || "Open Form"}
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-100 p-3">
                <div className="mx-auto max-w-[240px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <p className="text-sm font-semibold text-slate-900">
                    {formName}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="h-8 rounded-lg bg-slate-100" />
                    <div className="h-8 rounded-lg bg-slate-100" />
                    <div className="h-9 rounded-lg bg-emerald-500/85" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-full bg-emerald-500 px-4 py-2 text-center text-sm font-semibold text-white">
                {buttonText || "Open Form"}
              </div>
              <div className="mt-4 rounded-2xl bg-slate-100 p-3">
                <div className="ml-auto w-full max-w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <p className="text-sm font-semibold text-slate-900">
                    {formName}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="h-8 rounded-lg bg-slate-100" />
                    <div className="h-8 rounded-lg bg-slate-100" />
                    <div className="h-9 rounded-lg bg-emerald-500/85" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrimaryShareActionButton({
  ariaLabel,
  idleIcon: IdleIcon,
  idleLabel,
  onClick,
  state,
}: {
  ariaLabel: string;
  idleIcon: LucideIcon;
  idleLabel: string;
  onClick: () => void;
  state: CopyFeedbackState;
}) {
  const Icon =
    state === "success" ? Check : state === "error" ? AlertCircle : IdleIcon;
  const label =
    state === "success" ? "Copied!" : state === "error" ? "Failed" : idleLabel;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[3.125rem] shrink-0 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-colors sm:min-w-[8.5rem]",
        state === "error"
          ? "bg-rose-600 hover:bg-rose-700"
          : "bg-emerald-600 hover:bg-emerald-700",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function ShareShortcutCard({
  ariaLabel,
  description,
  href,
  icon: Icon,
  isActive = false,
  onClick,
  title,
}: {
  ariaLabel?: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick?: () => void;
  title: string;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-white/90">
        <Icon className="h-5 w-5" />
      </span>
      <span className="block space-y-1">
        <span className="block text-sm font-semibold text-slate-950">
          {title}
        </span>
        <span className="block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </>
  );

  const className = cn(
    "group flex h-full min-w-0 flex-col items-start gap-3 rounded-[1.1rem] border p-4 text-left transition-colors",
    isActive
      ? "border-emerald-300 bg-emerald-50"
      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50",
  );

  if (href) {
    return (
      <a href={href} className={className} aria-label={ariaLabel ?? title}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? title}
      aria-pressed={isActive}
      className={className}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function SurfaceNotice({
  description,
  icon: Icon,
  title,
  tone = "tip",
}: {
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: "info" | "tip" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "warning" && "border-amber-200 bg-amber-50/90",
        tone === "info" && "border-sky-200 bg-sky-50/90",
        tone === "tip" && "border-emerald-100 bg-emerald-50/80",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm",
            tone === "warning" && "text-amber-700",
            tone === "info" && "text-sky-700",
            tone === "tip" && "text-emerald-600",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

function formatPublicUrlForDisplay(url: string) {
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1) ?? "";

    if (lastSegment.length > 14) {
      const truncatedSegment = `${lastSegment.slice(0, 8)}...${lastSegment.slice(-5)}`;
      const leadingSegments = segments.slice(0, -1).join("/");
      const leadingPath = leadingSegments
        ? `/${leadingSegments}/`
        : parsedUrl.pathname;

      return `${parsedUrl.origin}${leadingPath}${truncatedSegment}`;
    }

    return url;
  } catch {
    return truncateMiddle(url, 32, 8);
  }
}

function truncateMiddle(value: string, startLength: number, endLength: number) {
  if (value.length <= startLength + endLength + 3) {
    return value;
  }

  return `${value.slice(0, startLength)}...${value.slice(-endLength)}`;
}

function buildQrDownloadFileBaseName(formName: string) {
  const slug = formName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "form"}-qr-code`;
}

function downloadQrDataUrl(dataUrl: string, fileName: string) {
  if (!dataUrl) {
    return;
  }

  triggerDownload(dataUrl, fileName);
}

function downloadQrSvg(svgMarkup: string, fileName: string) {
  if (!svgMarkup) {
    return;
  }

  const svgBlob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    triggerDownload(objectUrl, fileName);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

function triggerDownload(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function CopyFieldRow({
  copyAriaLabel,
  copyState,
  helper,
  label,
  onCopy,
  value,
}: {
  copyAriaLabel: string;
  copyState: CopyFeedbackState;
  helper?: string;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {helper ? (
          <p className="text-sm leading-6 text-slate-500">{helper}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={value}
          className="h-11 rounded-xl border-slate-200 bg-white font-mono text-sm"
        />
        <CopyButton
          aria-label={copyAriaLabel}
          className="w-full sm:w-[8.75rem]"
          onClick={onCopy}
          state={copyState}
        />
      </div>
    </div>
  );
}
