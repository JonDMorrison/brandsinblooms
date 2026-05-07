// Shared content shape for every /features/<slug> landing page.
// One config object per page is rendered by the shared FeaturePage
// component — adding a new page is "write a config + register the slug",
// not "write a new page from scratch".

export interface FeaturePagePain {
  title: string;
  description: string;
}

export interface FeaturePageCapability {
  title: string;
  description: string;
}

export interface FeaturePageOutcome {
  title: string;
  description: string;
}

export interface FeaturePageIntegrationLogo {
  name: string;
}

export interface FeaturePageScenario {
  title: string;
  description: string;
}

export interface FeaturePageFaqItem {
  question: string;
  answer: string;
}

export interface FeaturePageKnowledgeArticle {
  title: string;
  description: string;
  href: string;
}

export interface FeaturePageRelatedLink {
  slug: string;
  title: string;
  description: string;
}

export interface FeaturePageContent {
  slug: string;
  seo: {
    title: string;
    description: string;
    canonical: string;
    ogImage?: string;
  };
  breadcrumbLabel: string;
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    illustrationSrc: string;
    illustrationAlt: string;
  };
  problem: {
    eyebrow: string;
    headline: string;
    pains: FeaturePagePain[];
  };
  capabilities: {
    eyebrow: string;
    headline: string;
    subhead: string;
    items: FeaturePageCapability[];
  };
  outcomes: {
    eyebrow: string;
    headline: string;
    items: FeaturePageOutcome[];
  };
  integrations?: {
    eyebrow: string;
    headline: string;
    logos: FeaturePageIntegrationLogo[];
  };
  useCases: {
    eyebrow: string;
    headline: string;
    scenarios: FeaturePageScenario[];
  };
  faq: {
    eyebrow: string;
    headline: string;
    items: FeaturePageFaqItem[];
  };
  knowledgeBase: {
    eyebrow: string;
    headline: string;
    articles: FeaturePageKnowledgeArticle[];
  };
  related: {
    eyebrow: string;
    headline: string;
    links: FeaturePageRelatedLink[];
  };
  cta: {
    headline: string;
    subhead: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
}
