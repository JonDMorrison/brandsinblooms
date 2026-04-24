import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  BookOpen,
  Braces,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";

import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocScrollProgress } from "@/components/docs/DocScrollProgress";
import { DocSection } from "@/components/docs/DocSection";
import { DocShell } from "@/components/docs/DocShell";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { NativeSelect } from "@/components/ui-legacy/native-select";
import { Skeleton } from "@/components/ui-legacy/skeleton";
import {
  useCopyFeedback,
  type CopyFeedbackState,
} from "@/hooks/useCopyFeedback";
import { useForm } from "@/hooks/useForms";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { trackFormBuilderAnalyticsEvent } from "@/lib/forms/analytics";
import {
  buildFormDocumentationModel,
  getAliasFormDocumentationPath,
  getCanonicalFormDocumentationPath,
  getCanonicalFormDocumentationUrl,
} from "@/lib/forms/documentation";
import { buildFormMarkdownForAI } from "@/lib/forms/markdown-generator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";
import { cn } from "@/lib/utils";

const DOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "field-reference", label: "Field Reference" },
  { id: "payload", label: "Payload" },
  { id: "starter-code", label: "Starter Code" },
  { id: "embed-runtime", label: "Embed Runtime" },
  { id: "response-contract", label: "Response Contract" },
  { id: "event-flow", label: "Event Flow" },
] as const;

function scrollToSection(sectionId: string) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
  window.history.replaceState(null, "", `#${sectionId}`);
}

export default function FormDocumentationPage() {
  const { formId } = useParams<{ formId: string }>();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const formQuery = useForm(formId, tenant?.id);
  const { toast } = useToast();
  const { copyValue, getCopyState } = useCopyFeedback();
  const contentRef = useRef<HTMLElement>(null);

  const form = formQuery.data;
  const model = useMemo(
    () => (form ? buildFormDocumentationModel(form) : null),
    [form],
  );
  const aiMarkdown = useMemo(
    () => (form ? buildFormMarkdownForAI(form) : null),
    [form],
  );

  const handleCopyExport = async ({
    description,
    key,
    target,
    value,
  }: {
    description: string;
    key: string;
    target: "ai-markdown" | "full-markdown";
    value: string | null;
  }) => {
    if (!form || !value) {
      return;
    }

    await copyValue({
      key,
      onSuccess: () => {
        toast({
          title: "Copied",
          description,
        });

        trackFormBuilderAnalyticsEvent("form_docs_markdown_copied", {
          form_id: form.id,
          form_status: form.status,
          target,
        });
      },
      onError: () => {
        toast({
          title: "Copy failed",
          description: "Please try again or copy the snippets individually.",
        });
      },
      value,
    });
  };

  if (tenantLoading || formQuery.isLoading) {
    return <DocumentationLoadingState />;
  }

  if (tenantError) {
    return (
      <DocumentationErrorState
        title="Workspace unavailable"
        description={tenantError}
      />
    );
  }

  if (formQuery.error) {
    return (
      <DocumentationErrorState
        title="Couldn’t load this form"
        description={
          formQuery.error instanceof Error
            ? formQuery.error.message
            : "Please refresh and try again."
        }
      />
    );
  }

  if (!form || !model) {
    return (
      <DocumentationErrorState
        title="Form not found"
        description="This form either does not exist in the active workspace or you no longer have access to it."
      />
    );
  }

  const canonicalUrl = getCanonicalFormDocumentationUrl(form.id);
  const editorPath = `/crm/forms/${form.id}`;
  const handleSectionSelection = (sectionId: string) => {
    trackFormBuilderAnalyticsEvent("form_docs_toc_selected", {
      form_id: form.id,
      form_status: form.status,
      section_id: sectionId,
    });
    scrollToSection(sectionId);
  };

  const apiEndpointDisplay = buildRelativeEndpointLabel(model.submitEndpoint);
  const schemaSummary = formatSchemaSummary(model.fieldCount, model.stepCount);

  const handleCopyMetadata = async ({
    description,
    key,
    value,
  }: {
    description: string;
    key: string;
    value: string;
  }) => {
    await copyValue({
      key,
      onSuccess: () => {
        toast({
          title: "Copied",
          description,
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

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{`${form.name} Developer Docs | BloomSuite`}</title>
        <meta
          name="description"
          content={`Live integration documentation for ${form.name}, including request payloads, embed snippets, and downstream event details.`}
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <DocShell
        sidebar={
          <FormDocumentationSidebar
            formName={form.name}
            onSectionSelect={handleSectionSelection}
            stepCount={model.stepCount}
            fieldCount={model.fieldCount}
            status={form.status}
          />
        }
      >
        <main ref={contentRef} className="min-w-0 max-w-[780px]">
          <DocScrollProgress targetRef={contentRef} />

          <header className="mb-12 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <Link
              to={editorPath}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Form Editor</span>
            </Link>

            <div className="mt-6 max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {form.name}
              </h1>
              <p className="mt-1 text-lg font-light text-gray-400">
                Developer Integration Reference
              </p>
              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Generated from the live form schema. All code examples use your
                actual field names, types, and API endpoints.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                variant="ghost"
                className="h-9 whitespace-normal border border-emerald-600 bg-white px-4 text-sm text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <a href={model.publicFormUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Public Form
                </a>
              </Button>

              <HeaderCopyActionButton
                ariaLabel="Copy Docs as Markdown"
                idleIcon={Copy}
                idleLabel="Copy Docs as Markdown"
                onClick={() =>
                  void handleCopyExport({
                    value: model.markdownGuide,
                    key: "full-doc-markdown",
                    target: "full-markdown",
                    description:
                      "The full Markdown export was copied to your clipboard.",
                  })
                }
                state={getCopyState("full-doc-markdown")}
                tone="subtle"
              />

              <HeaderCopyActionButton
                ariaLabel="Copy for AI Agents"
                idleIcon={Bot}
                idleLabel="Copy for AI Agents"
                onClick={() =>
                  void handleCopyExport({
                    value: aiMarkdown,
                    key: "ai-doc-markdown",
                    target: "ai-markdown",
                    description:
                      "The AI-ready Markdown spec was copied to your clipboard.",
                  })
                }
                state={getCopyState("ai-doc-markdown")}
                tone="accent"
              />
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6">
              <TooltipProvider delayDuration={150}>
                <div className="rounded-[1.25rem] bg-gray-50/70 px-4 py-5 sm:px-5">
                  <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    <HeaderMetadataItem
                      copyAriaLabel="Copy Form ID"
                      copyState={getCopyState("header-form-id")}
                      displayValue={form.id}
                      fullValue={form.id}
                      label="Form ID"
                      onCopy={() =>
                        void handleCopyMetadata({
                          key: "header-form-id",
                          value: form.id,
                          description:
                            "The form ID was copied to your clipboard.",
                        })
                      }
                    />

                    <HeaderMetadataItem
                      copyAriaLabel="Copy API endpoint"
                      copyState={getCopyState("header-api-endpoint")}
                      displayValue={apiEndpointDisplay}
                      fullValue={`POST ${model.submitEndpoint}`}
                      label="API Endpoint"
                      onCopy={() =>
                        void handleCopyMetadata({
                          key: "header-api-endpoint",
                          value: model.submitEndpoint,
                          description:
                            "The API endpoint was copied to your clipboard.",
                        })
                      }
                    />

                    <HeaderMetadataItem
                      copyAriaLabel="Copy Embed Key"
                      copyState={getCopyState("header-embed-key")}
                      displayValue={form.embed_key}
                      fullValue={form.embed_key}
                      label="Embed Key"
                      onCopy={() =>
                        void handleCopyMetadata({
                          key: "header-embed-key",
                          value: form.embed_key,
                          description:
                            "The embed key was copied to your clipboard.",
                        })
                      }
                    />

                    <HeaderMetadataItem
                      displayValue={schemaSummary}
                      fullValue={schemaSummary}
                      label="Schema"
                      monospaced={false}
                    />
                  </div>
                </div>
              </TooltipProvider>
            </div>

            {form.status !== "published" ? (
              <NoticeCard
                className="mt-6 border-amber-200 bg-amber-50/90 text-amber-900"
                icon={<AlertCircle className="h-4 w-4" />}
                title="Publish before testing the live endpoint"
                description="The public BloomSuite submit endpoint only accepts published forms. Until this form is published, external requests to the app-hosted route return a 404 response."
              />
            ) : null}

            {model.isEmpty ? (
              <NoticeCard
                className="mt-4 border-slate-200 bg-slate-50 text-slate-900"
                icon={<BookOpen className="h-4 w-4" />}
                title="This form is still empty"
                description="The documentation stays live so implementation can begin, but the payload examples only include optional metadata until fields are added in the form builder."
              />
            ) : null}
          </header>

          <DocSection id="overview" title="Overview">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
                <p className="text-sm leading-7 text-slate-700">
                  Direct submissions post to the BloomSuite-hosted public submit
                  endpoint for this form. The app-hosted proxy resolves the
                  embed key server-side, so new clients should send the flat
                  schema-aware payload shown here rather than posting raw
                  embed-key wrappers.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-slate-950 p-5 text-slate-50 shadow-sm shadow-slate-900/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Current contract
                </p>
                <dl className="mt-4 space-y-4 text-sm">
                  <SummaryRow
                    label="Submit endpoint"
                    value={model.submitEndpoint}
                  />
                  <SummaryRow
                    label="Public form URL"
                    value={model.publicFormUrl}
                  />
                  <SummaryRow
                    label="Consent required"
                    value={formatConsentSummary(
                      model.requiresEmailConsent,
                      model.requiresSmsConsent,
                    )}
                  />
                  <SummaryRow
                    label="Alias route"
                    value={getAliasFormDocumentationPath(form.id)}
                  />
                </dl>
              </div>
            </div>
          </DocSection>

          <DocSection id="field-reference" title="Field Reference">
            {model.isEmpty ? (
              <NoticeCard
                className="border-slate-200 bg-white/90 text-slate-900"
                icon={<BookOpen className="h-4 w-4" />}
                title="No fields to document yet"
                description="Add fields in the form builder to populate this reference. Until then, the payload and starter code sections intentionally stay minimal and metadata-only."
              />
            ) : (
              <div className="space-y-5">
                {model.stepReferences.map((step) => (
                  <section
                    key={step.id}
                    className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm shadow-slate-900/5"
                  >
                    <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-600"
                        >
                          Step {step.index + 1}
                        </Badge>
                        <h3 className="text-base font-semibold text-slate-950">
                          {step.title}
                        </h3>
                      </div>
                      {step.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {step.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="divide-y divide-slate-100">
                      {step.fields.map((field) => (
                        <FieldReferenceRow key={field.fieldId} field={field} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </DocSection>

          <DocSection id="payload" title="Payload">
            <div className="space-y-4 rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
              {model.hasFileUploads ? (
                <NoticeCard
                  className="border-sky-200 bg-sky-50/80 text-slate-900"
                  icon={<Paperclip className="h-4 w-4" />}
                  title="File uploads use references"
                  description="File upload fields must submit upload references from the file-upload flow, not raw multipart files. The payload and starter code below intentionally document the JSON reference contract."
                />
              ) : null}
              <NoticeCard
                className="border-emerald-100 bg-emerald-50/80 text-slate-900"
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Preferred keys are schema-aware"
                description="If a field has a stable mapping key such as email or phone, the docs use that. If a field only has a generic or duplicated mapping key, the docs fall back to the field ID so the example stays unambiguous."
              />
              <DocCodeBlock
                language="ts"
                code={model.typescriptSchemaSnippet}
                ariaLabel="TypeScript payload shape"
              />
              <DocCodeBlock
                language="json"
                code={model.requestExample}
                ariaLabel="JSON request example"
              />
            </div>
          </DocSection>

          <DocSection id="starter-code" title="Starter Code">
            <div className="space-y-5">
              <CodeCard
                icon={<Terminal className="h-4 w-4" />}
                title="cURL"
                description="Use this from a terminal, server job, or low-level integration test."
                language="bash"
                code={model.curlSnippet}
              />
              <CodeCard
                icon={<Code2 className="h-4 w-4" />}
                title="Browser fetch"
                description="A direct client-side example using the live form schema and the public BloomSuite submit endpoint."
                language="ts"
                code={model.fetchSnippet}
              />
              <CodeCard
                icon={<Braces className="h-4 w-4" />}
                title="Next.js proxy route"
                description="Useful when you want your app server to own analytics, auth, or origin controls before forwarding to BloomSuite."
                language="ts"
                code={model.nextJsSnippet}
              />
            </div>
          </DocSection>

          <DocSection id="embed-runtime" title="Embed Runtime">
            <div className="space-y-4 rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard
                  label="App-hosted runtime"
                  value={model.runtimeUrl}
                  icon={<Globe className="h-4 w-4" />}
                />
                <InfoCard
                  label="Public form URL"
                  value={model.publicFormUrl}
                  icon={<ExternalLink className="h-4 w-4" />}
                />
              </div>
              <CodeCard
                icon={<Link2 className="h-4 w-4" />}
                title="Inline embed"
                description="Best when the form should appear directly in the page flow."
                language="html"
                code={model.inlineEmbedSnippet}
              />
              <CodeCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Modal embed"
                description="Best when you want the form behind a button without leaving the page."
                language="html"
                code={model.modalEmbedSnippet}
              />
              <CodeCard
                icon={<BookOpen className="h-4 w-4" />}
                title="React runtime"
                description="Useful when you want React to own the container but still load the shared runtime."
                language="tsx"
                code={model.reactEmbedSnippet}
              />
              <CodeCard
                icon={<Globe className="h-4 w-4" />}
                title="Iframe fallback"
                description="Keep this for website builders that prefer a single iframe snippet."
                language="html"
                code={model.iframeEmbedSnippet}
              />
            </div>
          </DocSection>

          <DocSection id="response-contract" title="Response Contract">
            <div className="grid gap-4 lg:grid-cols-2">
              <ResponseExampleCard
                statusLabel="200 OK"
                title="Accepted submission"
                code={model.successResponseExample}
              />
              <ResponseExampleCard
                statusLabel="400 Bad Request"
                title="Validation or consent failure"
                code={model.validationErrorExample}
              />
              <ResponseExampleCard
                statusLabel="404 Not Found"
                title="Draft or missing form"
                code={model.notFoundErrorExample}
              />
              <ResponseExampleCard
                statusLabel="429 Too Many Requests"
                title="Rate limit response"
                code={model.rateLimitErrorExample}
              />
            </div>
          </DocSection>

          <DocSection id="event-flow" title="Event Flow">
            <div className="space-y-4 rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
              <NoticeCard
                className="border-slate-200 bg-slate-50 text-slate-900"
                icon={<BookOpen className="h-4 w-4" />}
                title="Internal today, useful for planning now"
                description="After an accepted submission, BloomSuite records an internal form_submitted automation event. Customer-managed outbound webhooks are not self-serve yet, but this is the event shape the platform currently emits downstream."
              />
              <DocCodeBlock
                language="json"
                code={model.eventPayloadSnippet}
                ariaLabel="Downstream event payload"
              />
            </div>
          </DocSection>
        </main>
      </DocShell>
    </div>
  );
}

function FormDocumentationSidebar({
  formName,
  fieldCount,
  onSectionSelect,
  stepCount,
  status,
}: {
  formName: string;
  fieldCount: number;
  onSectionSelect: (sectionId: string) => void;
  stepCount: number;
  status: string;
}) {
  const [activeSection, setActiveSection] = useState(DOC_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) {
          return;
        }

        visibleEntries.sort(
          (left, right) => right.intersectionRatio - left.intersectionRatio,
        );
        setActiveSection(visibleEntries[0].target.id);
      },
      {
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    DOC_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="lg:hidden">
        <div className="sticky top-4 z-10 mb-6 rounded-[1.25rem] border border-gray-200 bg-gray-50/95 p-4 shadow-sm">
          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                {formName}
              </p>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {formatCompactSchemaSummary(fieldCount, stepCount)}
            </p>
          </div>
          <NativeSelect
            aria-label="Documentation sections"
            value={activeSection}
            onChange={(event) => {
              const nextSection = event.target.value;
              setActiveSection(nextSection);
              onSectionSelect(nextSection);
            }}
            className="h-10 rounded-xl border-slate-200 bg-white text-sm"
          >
            {DOC_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-6 rounded-[1.5rem] bg-gray-50 p-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 flex-1 text-lg font-bold text-gray-900">
                {formName}
              </h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {formatCompactSchemaSummary(fieldCount, stepCount)}
            </p>
          </div>

          <nav aria-label="Documentation table of contents" className="mt-6">
            <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              On this page
            </p>
            <div className="space-y-1">
              {DOC_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;

                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "block w-full border-l-2 px-4 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "border-emerald-500 font-medium text-emerald-600"
                        : "border-transparent text-gray-600 hover:border-gray-200 hover:text-gray-900",
                    )}
                    onClick={() => {
                      setActiveSection(section.id);
                      onSectionSelect(section.id);
                    }}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}

function DocumentationLoadingState() {
  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-[1100px] space-y-8">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton className="h-[420px] rounded-[1.75rem]" />
          <div className="space-y-5">
            <Skeleton className="h-48 rounded-[2rem]" />
            <Skeleton className="h-56 rounded-[1.5rem]" />
            <Skeleton className="h-72 rounded-[1.5rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentationErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-200 bg-gray-50/50 p-8 shadow-sm shadow-slate-900/5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <Button variant="outline" asChild className="mt-3">
              <Link to="/crm/forms">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forms
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        <span className="text-emerald-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 break-all text-sm font-medium leading-6 text-slate-900">
        {value}
      </p>
    </div>
  );
}

function NoticeCard({
  className,
  description,
  icon,
  title,
}: {
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className={cn("rounded-[1.35rem] border px-4 py-4", className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
}

function HeaderCopyActionButton({
  ariaLabel,
  idleIcon: IdleIcon,
  idleLabel,
  onClick,
  state,
  tone,
}: {
  ariaLabel: string;
  idleIcon: typeof Copy;
  idleLabel: string;
  onClick: () => void;
  state: CopyFeedbackState;
  tone: "subtle" | "accent";
}) {
  const Icon =
    state === "success" ? Check : state === "error" ? AlertCircle : IdleIcon;
  const label =
    state === "success" ? "Copied!" : state === "error" ? "Failed" : idleLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "h-9 whitespace-normal px-4 text-sm",
        state === "success" &&
          "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700",
        state === "error" &&
          "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-700",
        state === "idle" &&
          tone === "subtle" &&
          "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800",
        state === "idle" &&
          tone === "accent" &&
          "bg-gray-900 text-white hover:bg-gray-800 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}

function HeaderMetadataItem({
  copyAriaLabel,
  copyState,
  displayValue,
  fullValue,
  label,
  monospaced = true,
  onCopy,
}: {
  copyAriaLabel?: string;
  copyState?: CopyFeedbackState;
  displayValue: string;
  fullValue: string;
  label: string;
  monospaced?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="group min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
          {label}
        </p>
        {onCopy && copyAriaLabel && copyState ? (
          <InlineCopyIconButton
            ariaLabel={copyAriaLabel}
            onClick={onCopy}
            state={copyState}
          />
        ) : null}
      </div>

      <div className="mt-2 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "block min-w-0 truncate text-sm text-gray-900",
                monospaced && "font-mono",
              )}
              title={fullValue}
            >
              {displayValue}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-all text-xs">
            {fullValue}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function InlineCopyIconButton({
  ariaLabel,
  onClick,
  state,
}: {
  ariaLabel: string;
  onClick: () => void;
  state: CopyFeedbackState;
}) {
  const Icon =
    state === "success" ? Check : state === "error" ? AlertCircle : Copy;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        state === "success" && "text-emerald-600 opacity-100",
        state === "error" && "text-rose-600 opacity-100",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = formatStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        status === "published"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {normalizedStatus}
    </span>
  );
}

function FieldReferenceRow({
  field,
}: {
  field: ReturnType<
    typeof buildFormDocumentationModel
  >["fieldReferences"][number];
}) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">
              {field.label}
            </p>
            <Badge
              variant="outline"
              className="border-slate-200 bg-white text-slate-600"
            >
              {field.typeLabel}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border-slate-200 bg-white text-slate-600",
                field.required
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500",
              )}
            >
              {field.required ? "Required" : "Optional"}
            </Badge>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            {field.description}
          </p>
          {field.note ? (
            <p className="text-sm leading-6 text-slate-600">{field.note}</p>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:min-w-[320px]">
          <KeyValue
            label="Preferred submit key"
            value={field.submissionKey}
            emphasized
          />
          <KeyValue
            label="CRM mapping"
            value={
              field.mappingKey === "custom"
                ? "submission-only"
                : field.mappingKey
            }
          />
          {field.options.length > 0 ? (
            <KeyValue
              label="Allowed options"
              value={field.options.join(", ")}
            />
          ) : null}
          <KeyValue
            label="Example value"
            value={formatExampleValue(field.exampleValue)}
          />
        </div>
      </div>
    </div>
  );
}

function KeyValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-all font-mono text-xs leading-6 text-slate-600",
          emphasized && "text-sm font-semibold text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CodeCard({
  code,
  description,
  icon,
  language,
  title,
}: {
  code: string;
  description: string;
  icon: ReactNode;
  language: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <DocCodeBlock
        code={code}
        language={language}
        ariaLabel={`${title} code`}
      />
    </div>
  );
}

function ResponseExampleCard({
  code,
  statusLabel,
  title,
}: {
  code: string;
  statusLabel: string;
  title: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{statusLabel}</p>
        </div>
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-600"
        >
          {statusLabel}
        </Badge>
      </div>
      <DocCodeBlock
        code={code}
        language="json"
        ariaLabel={`${title} response`}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-all leading-6 text-inherit">{value}</dd>
    </div>
  );
}

function formatConsentSummary(
  requiresEmailConsent: boolean,
  requiresSmsConsent: boolean,
): string {
  if (requiresEmailConsent && requiresSmsConsent) {
    return "Email and SMS consent";
  }

  if (requiresEmailConsent) {
    return "Email consent";
  }

  if (requiresSmsConsent) {
    return "SMS consent";
  }

  return "No extra consent requirement";
}

function formatSchemaSummary(fieldCount: number, stepCount: number): string {
  return `${fieldCount} ${fieldCount === 1 ? "field" : "fields"} across ${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
}

function formatCompactSchemaSummary(
  fieldCount: number,
  stepCount: number,
): string {
  return `${fieldCount} ${fieldCount === 1 ? "field" : "fields"} · ${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
}

function formatStatusLabel(status: string): string {
  if (!status) {
    return "Draft";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildRelativeEndpointLabel(endpoint: string): string {
  try {
    return `POST ${new URL(endpoint).pathname}`;
  } catch {
    if (endpoint.startsWith("POST ")) {
      return endpoint;
    }

    if (endpoint.startsWith("/")) {
      return `POST ${endpoint}`;
    }

    return endpoint;
  }
}

function formatExampleValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
