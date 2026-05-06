export const HOMEPAGE_SEO = {
  title:
    "BloomSuite — AI-Powered CRM for Garden Centres, Florists & Green Businesses",
  description:
    "BloomSuite unites AI CRM, campaigns, automation and integrations for garden centres, florists and green businesses.",
  url: "https://bloomsuite.app/",
  imageUrl: "https://bloomsuite.app/og-image.png",
  imageAlt:
    "BloomSuite AI-powered CRM for garden centres, florists and green businesses",
};

export const HOMEPAGE_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BloomSuite",
    url: HOMEPAGE_SEO.url,
    logo: "https://bloomsuite.app/favicon.png",
    sameAs: [
      "https://www.linkedin.com/",
      "https://x.com/",
      "https://www.instagram.com/",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BloomSuite",
    url: HOMEPAGE_SEO.url,
    description: HOMEPAGE_SEO.description,
    publisher: {
      "@type": "Organization",
      name: "BloomSuite",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BloomSuite",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: HOMEPAGE_SEO.url,
    description: HOMEPAGE_SEO.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      category: "FreeTrial",
    },
    audience: {
      "@type": "Audience",
      audienceType: "Garden centres, florists and green businesses",
    },
  },
];
