import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { DocHeader } from "@/components/docs/DocHeader";
import { DocScrollProgress } from "@/components/docs/DocScrollProgress";
import { DocSection } from "@/components/docs/DocSection";
import { DocShell } from "@/components/docs/DocShell";
import { DocSidebar } from "@/components/docs/DocSidebar";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui-legacy/breadcrumb";
import { getDocumentationContent } from "@/pages/integrations/documentation/content";

export default function IntegrationDocumentationPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLElement>(null);

  const seed = useMemo(() => (slug ? getIntegrationSeed(slug) : null), [slug]);
  const content = useMemo(
    () => (seed ? getDocumentationContent(seed.slug) : null),
    [seed],
  );

  useEffect(() => {
    if (seed && content) {
      return;
    }

    toast.error("Documentation not available for this integration");
    navigate("/integrations", { replace: true });
  }, [content, navigate, seed]);

  if (!seed || !content) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto space-y-6 px-6 pt-6">
        <Breadcrumb>
          <BreadcrumbList className="flex-wrap gap-2 rounded-full border border-border/70 bg-white/90 px-4 py-2 text-sm shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/integrations">Integrations</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to={`/integrations/${seed.slug}`}>{seed.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-brand-navy">
                Documentation
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <DocShell
        sidebar={
          <DocSidebar
            integrationName={content.integrationName}
            integrationSlug={seed.slug}
            sections={content.sections}
            branding={content.branding}
          />
        }
      >
        <main ref={contentRef} className="max-w-[760px] min-w-0">
          <DocScrollProgress targetRef={contentRef} />
          <DocHeader
            integrationName={content.integrationName}
            category={content.category}
            pageTitle={content.pageTitle}
            overview={content.overview}
            lastUpdated={content.lastUpdated}
            readingTimeMinutes={content.readingTimeMinutes}
            branding={content.branding}
          />
          {content.sections.map((section) => (
            <DocSection key={section.id} id={section.id} title={section.title}>
              {section.content}
            </DocSection>
          ))}
        </main>
      </DocShell>
    </div>
  );
}
