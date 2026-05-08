import type { FeaturePageContent } from "./featurePageContent";
import { customerCrmContent } from "./content/customerCrmContent";
import { campaignsContent } from "./content/campaignsContent";
import { inventoryOrdersContent } from "./content/inventoryOrdersContent";
import { storefrontContent } from "./content/storefrontContent";
import { analyticsContent } from "./content/analyticsContent";
import { unifiedPlatformContent } from "./content/unifiedPlatformContent";

// Registry of slugs → content config. New feature pages are added by
// dropping a content file in ./content/ and registering it here.
// Stage 2 brings the registry to all six slugs (customer-crm + the
// five companions); the FeatureDetailPage redirects unregistered
// slugs back to /features so the route layer fails soft.
export const FEATURE_PAGE_REGISTRY: Record<string, FeaturePageContent> = {
  [customerCrmContent.slug]: customerCrmContent,
  [campaignsContent.slug]: campaignsContent,
  [inventoryOrdersContent.slug]: inventoryOrdersContent,
  [storefrontContent.slug]: storefrontContent,
  [analyticsContent.slug]: analyticsContent,
  [unifiedPlatformContent.slug]: unifiedPlatformContent,
};

export function getFeaturePageContent(
  slug: string | undefined,
): FeaturePageContent | null {
  if (!slug) return null;
  return FEATURE_PAGE_REGISTRY[slug] ?? null;
}
