import type { FeaturePageContent } from "./featurePageContent";
import { customerCrmContent } from "./content/customerCrmContent";

// Registry of slugs → content config. New feature pages are added by
// dropping a content file in ./content/ and registering it here.
// Stage 1 ships Customer CRM only. The other five (campaigns,
// inventory-orders, storefront, analytics, unified-platform) land in
// Stage 2 using the same shape.
export const FEATURE_PAGE_REGISTRY: Record<string, FeaturePageContent> = {
  [customerCrmContent.slug]: customerCrmContent,
};

export function getFeaturePageContent(
  slug: string | undefined,
): FeaturePageContent | null {
  if (!slug) return null;
  return FEATURE_PAGE_REGISTRY[slug] ?? null;
}
