import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Braces, Lightbulb, Terminal } from "lucide-react";

import { DocScrollProgress } from "@/components/docs/DocScrollProgress";
import { DocSection } from "@/components/docs/DocSection";
import { DocShell } from "@/components/docs/DocShell";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import {
  buildCurlSubmissionSnippet,
  buildNextJsSubmissionSnippet,
  buildReactSubmissionSnippet,
  getFormSubmissionEndpoint,
  getStaticEmbedScriptUrl,
} from "@/lib/forms/share";

const DOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "submissions", label: "Submission Endpoint" },
  { id: "embed-runtime", label: "Embed Runtime" },
  { id: "next-steps", label: "Next Steps" },
] as const;

const EXAMPLE_FORM_ID = "your-form-id";
const EXAMPLE_EMBED_KEY = "your-embed-key";

export default function FormDeveloperGuidePage() {
  const contentRef = useRef<HTMLElement>(null);
  const endpoint = useMemo(() => getFormSubmissionEndpoint(), []);
  const runtimeUrl = useMemo(() => getStaticEmbedScriptUrl(), []);

  const curlExample = useMemo(
    () =>
      buildCurlSubmissionSnippet({
        embedKey: EXAMPLE_EMBED_KEY,
        formId: EXAMPLE_FORM_ID,
      }),
    [],
  );
  const reactExample = useMemo(
    () =>
      buildReactSubmissionSnippet({
        embedKey: EXAMPLE_EMBED_KEY,
        formId: EXAMPLE_FORM_ID,
      }),
    [],
  );
  const nextExample = useMemo(
    () =>
      buildNextJsSubmissionSnippet({
        embedKey: EXAMPLE_EMBED_KEY,
        formId: EXAMPLE_FORM_ID,
      }),
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DocShell
        sidebar={
          <aside className="min-w-0 rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5 min-[900px]:sticky min-[900px]:top-8 min-[900px]:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Developer Guide
            </p>
            <nav className="mt-4 space-y-2">
              {DOC_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>
                  This is the Milestone 1 starter guide. Full AI-ready setup
                  guides and richer framework examples land in the next
                  milestones.
                </p>
              </div>
            </div>
          </aside>
        }
      >
        <main ref={contentRef} className="min-w-0 max-w-[760px]">
          <DocScrollProgress targetRef={contentRef} />

          <header className="mb-8 border-b border-gray-200 pb-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Form Builder
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-600"
              >
                Live contract
              </Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              Developer Integration Guide
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-muted-foreground">
              Use this guide when you want to submit a BloomSuite form from your
              own code, wire the embed runtime into a custom site, or hand the
              live contract to a developer without leaving the product.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/crm/forms">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Forms
                </Link>
              </Button>
            </div>
          </header>

          <DocSection id="overview" title="Overview">
            <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
              <p className="text-sm leading-7 text-slate-700">
                The current live contract uses the public{" "}
                <strong>embed key</strong>
                as the submission identifier and posts to the shared submit-form
                endpoint. Internal form IDs are useful for your records and
                internal tooling, but direct submissions should always include
                the public embed key.
              </p>
            </div>
          </DocSection>

          <DocSection id="submissions" title="Submission Endpoint">
            <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-950">
                  POST {endpoint}
                </p>
              </div>
              <CodeCard label="cURL example" value={curlExample} />
              <CodeCard label="React example" value={reactExample} />
            </div>
          </DocSection>

          <DocSection id="embed-runtime" title="Embed Runtime">
            <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
              <div className="flex items-center gap-3">
                <Braces className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-950">
                  App-hosted runtime: {runtimeUrl}
                </p>
              </div>
              <p className="text-sm leading-7 text-slate-700">
                For website embeds, use the app-hosted runtime shown above. It
                is the same script the redesigned Share modal now generates by
                default.
              </p>
              <CodeCard label="Next.js starter" value={nextExample} />
            </div>
          </DocSection>

          <DocSection id="next-steps" title="Next Steps">
            <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="space-y-3 text-sm leading-7 text-slate-700">
                  <p>
                    Milestone 2 expands this page into a fuller reference with
                    richer examples, step-by-step integration walkthroughs, and
                    deeper framework coverage.
                  </p>
                  <p>
                    Milestone 3 adds the AI-ready Markdown export directly from
                    the Share modal so you can hand the guide to Copilot,
                    Cursor, or another coding assistant without rewriting the
                    contract yourself.
                  </p>
                </div>
              </div>
            </div>
          </DocSection>
        </main>
      </DocShell>
    </div>
  );
}

function CodeCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-slate-800">
        <code>{value}</code>
      </pre>
    </div>
  );
}
