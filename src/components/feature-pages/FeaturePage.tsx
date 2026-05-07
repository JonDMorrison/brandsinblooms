import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import type { FeaturePageContent } from "./featurePageContent";
import { FeaturePageHero } from "./sections/FeaturePageHero";
import { FeaturePageProblem } from "./sections/FeaturePageProblem";
import { FeaturePageCapabilities } from "./sections/FeaturePageCapabilities";
import { FeaturePageOutcomes } from "./sections/FeaturePageOutcomes";
import { FeaturePageIntegrations } from "./sections/FeaturePageIntegrations";
import { FeaturePageUseCases } from "./sections/FeaturePageUseCases";
import { FeaturePageFaq } from "./sections/FeaturePageFaq";
import { FeaturePageKnowledgeBase } from "./sections/FeaturePageKnowledgeBase";
import { FeaturePageRelated } from "./sections/FeaturePageRelated";
import { FeaturePageCta } from "./sections/FeaturePageCta";

interface FeaturePageProps {
  content: FeaturePageContent;
}

const SITE_ORIGIN = "https://www.bloomsuite.app";

function buildFaqJsonLd(faq: FeaturePageContent["faq"]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function buildBreadcrumbJsonLd(content: FeaturePageContent) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Features",
        item: `${SITE_ORIGIN}/features`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: content.breadcrumbLabel,
        item: content.seo.canonical,
      },
    ],
  };
}

export const FeaturePage = ({ content }: FeaturePageProps) => {
  const navigate = useNavigate();
  const faqJsonLd = buildFaqJsonLd(content.faq);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(content);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{content.seo.title}</title>
        <meta name="description" content={content.seo.description} />
        <link rel="canonical" href={content.seo.canonical} />

        {/* Open Graph */}
        <meta property="og:title" content={content.seo.title} />
        <meta property="og:description" content={content.seo.description} />
        <meta property="og:url" content={content.seo.canonical} />
        <meta property="og:type" content="website" />
        {content.seo.ogImage ? (
          <meta property="og:image" content={content.seo.ogImage} />
        ) : null}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.seo.title} />
        <meta name="twitter:description" content={content.seo.description} />
        {content.seo.ogImage ? (
          <meta name="twitter:image" content={content.seo.ogImage} />
        ) : null}

        {/* Structured data — FAQPage + BreadcrumbList. Helmet allows
            children scripts; we stringify the JSON-LD payload so React
            does not try to evaluate it. */}
        <script type="application/ld+json">
          {JSON.stringify(faqJsonLd)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      </Helmet>

      <LandingPageHeader onLogin={() => navigate("/auth")} />

      <main>
        <FeaturePageHero hero={content.hero} cta={content.cta} />
        <FeaturePageProblem problem={content.problem} />
        <FeaturePageCapabilities capabilities={content.capabilities} />
        <FeaturePageOutcomes outcomes={content.outcomes} />
        {content.integrations ? (
          <FeaturePageIntegrations integrations={content.integrations} />
        ) : null}
        <FeaturePageUseCases useCases={content.useCases} />
        <FeaturePageFaq faq={content.faq} />
        <FeaturePageKnowledgeBase knowledgeBase={content.knowledgeBase} />
        <FeaturePageRelated related={content.related} />
        <FeaturePageCta cta={content.cta} />
      </main>
    </div>
  );
};

export default FeaturePage;
