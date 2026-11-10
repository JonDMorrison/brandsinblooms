import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Breadcrumbs, Typography } from "@mui/joy";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";

import { DocHeader } from "@/components/docs/DocHeader";
import { DocScrollProgress } from "@/components/docs/DocScrollProgress";
import { DocSection } from "@/components/docs/DocSection";
import { DocShell } from "@/components/docs/DocShell";
import { DocSidebar } from "@/components/docs/DocSidebar";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { getDocumentationContent } from "@/pages/integrations/documentation/content";

export default function IntegrationDocumentationPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLElement>(null);

  const seed = useMemo(() => (slug ? getIntegrationSeed(slug) : null), [slug]);
  const content = useMemo(
    () => (seed ? getDocumentationContent(seed.slug) : null),
    [seed],
  );
  const isPublicDocumentation = location.pathname.startsWith("/docs/");

  useEffect(() => {
    if (seed && content) {
      return;
    }

    toast.error("Documentation not available for this integration");
    navigate(isPublicDocumentation ? "/knowledge-base" : "/integrations", {
      replace: true,
    });
  }, [content, isPublicDocumentation, navigate, seed]);

  if (!seed || !content) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{content.pageTitle} | BloomSuite Documentation</title>
        <meta name="description" content={content.overview} />
        <link
          rel="canonical"
          href={`https://bloomsuite.app/docs/integrations/${seed.slug}`}
        />
      </Helmet>
      <div className="container mx-auto space-y-6 px-6 pt-6">
        <Breadcrumbs
          size="sm"
          aria-label="Integration documentation breadcrumb"
        >
          <Link to={isPublicDocumentation ? "/" : "/dashboard"}>
            <Typography level="body-sm" color="neutral">
              {isPublicDocumentation ? "BloomSuite" : "Dashboard"}
            </Typography>
          </Link>
          <Link
            to={isPublicDocumentation ? "/knowledge-base" : "/integrations"}
          >
            <Typography level="body-sm" color="neutral">
              {isPublicDocumentation ? "Help Centre" : "Integrations"}
            </Typography>
          </Link>
          {isPublicDocumentation ? (
            <Typography level="body-sm" color="neutral">
              {seed.name}
            </Typography>
          ) : (
            <Link to={`/integrations/${seed.slug}`}>
              <Typography level="body-sm" color="neutral">
                {seed.name}
              </Typography>
            </Link>
          )}
          <Typography level="body-sm" fontWeight="lg">
            Documentation
          </Typography>
        </Breadcrumbs>
      </div>

      <DocShell
        sidebar={
          <DocSidebar
            integrationName={content.integrationName}
            integrationSlug={seed.slug}
            sections={content.sections}
            branding={content.branding}
            backHref={isPublicDocumentation ? "/knowledge-base" : undefined}
            backLabel={isPublicDocumentation ? "Back to Help Centre" : undefined}
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
