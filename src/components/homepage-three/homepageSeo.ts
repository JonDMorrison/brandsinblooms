export const HOMEPAGE_SEO = {
  title:
    "BloomSuite — CRM, POS & Websites for Garden Centres",
  description:
    "Sell more plants, simplify store operations and grow repeat business with BloomSites, BloomSuite POS and BloomSuite CRM, built for independent garden centres.",
  url: "https://bloomsuite.app/",
  imageUrl: "https://bloomsuite.app/og-image.png",
  imageAlt:
    "BloomSuite websites, point of sale and customer marketing for garden centres",
};

export const HOMEPAGE_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BloomSuite",
    url: HOMEPAGE_SEO.url,
    logo: "https://bloomsuite.app/favicon.png",
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
    audience: {
      "@type": "Audience",
      audienceType: "Garden centres, florists and green businesses",
    },
  },
];

