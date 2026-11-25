# BloomSuite connected platform marketing standard
Updated 2026-11-24. Owner: marketing/product leadership. This is a copy and evidence register, not an activation record.

## Message
Sell more plants. Make life easier. Keep customers coming back.
Quality plants bring customers in. Strong relationships bring them back.
BloomSuite is the software family by Brands in Blooms; BloomSites = websites and online selling, BloomSuite POS = physical retail operations, BloomSuite CRM = relationships and marketing. Start with what you need; connect supported capabilities as your business grows.

## Customer journey
Discover and choose (BloomSites + plant intelligence); buy online (BloomSites) or in-store (POS); request reviewed plant guidance (eligible care-guide rollout); stay connected through permission-based CRM marketing; return. Never imply marketing permission follows from a purchase.

## Evidence directory
| Feature | Approved benefit / wording | Evidence | Availability boundary |
| --- | --- | --- | --- |
| Websites and online sales | Showcase plants, sell online, run events, fundraisers and preorders | [BloomSites knowledge base](https://github.com/Brands-In-Blooms/cms-brandsinblooms/tree/main/docs/bloomsites) | Store setup and eligible checkout required |
| Plant catalogue and finder | Help shoppers discover suitable plants and reduce repeated data entry | [Catalogue](https://github.com/Brands-In-Blooms/cms-brandsinblooms/blob/main/docs/bloomsites/03-products-and-master-catalogue.md) | Distinguish browse-only from purchasable; verify plant identity, rights and source coverage |
| Supplier assortment | Showcase a wider eligible supplier range without stocking every plant | [Prides certification](https://github.com/Brands-In-Blooms/cms-brandsinblooms/blob/main/docs/integrations/prides-certification-2026-10-30.md) | Joint certification, retailer credit and activation required; no unconditional shipping promise |
| POS | Simplify checkout, inventory, purchasing and receiving | [POS repository](https://github.com/Brands-In-Blooms/bloomtill) | Confirm provider, hardware and store readiness; do not imply offline card acceptance |
| CRM | Understand available customer information and encourage return visits via email/SMS | [CRM repository](https://github.com/JonDMorrison/brandsinblooms) | Consent, sender configuration and data coverage required |
| Care guides | Offer helpful reviewed plant guidance after purchase | [CMS care pilot](https://github.com/Brands-In-Blooms/cms-brandsinblooms/blob/main/docs/features/master-care-guide-pilot.md), [CRM Studio](https://github.com/JonDMorrison/brandsinblooms/blob/main/src/pages/crm/CareGuideStudioPage.tsx), [POS](https://github.com/Brands-In-Blooms/bloomtill/blob/main/supabase/functions/care-guide-email/index.ts) | Pilot/feature flags; confirm Northfield end-to-end and consent before general availability claims |
| Connected commerce | Connect supported systems and reduce duplicate work | [Unified platform contract](https://github.com/Brands-In-Blooms/bloomtill/blob/main/docs/architecture/bloomsuite-unified-platform.md), [current integration spec](https://github.com/Brands-In-Blooms/bloomtill/blob/main/docs/spec/06-integration.md) | Canonical identity, inventory, orders and shared login are target architecture; do not imply universal live sync |
| Ask Bloom | Ask questions about available authorized store data | CRM repository | Data coverage and supported queries vary; no guaranteed accuracy or unrestricted write access |
| Interactive showroom | Explore synthetic demo data without touching a real store | [Showroom tracking](https://github.com/Brands-In-Blooms/bloomtill/issues/811) | Verify each public route, reset and simulated checkout before promoting |

## Publication rules
Use this directory for product pages, Prides sales guide, webinar, sales proposals, support and demos. Add a dated production verification, screenshot/demo link, feature owner and setup prerequisites to each launch record before claiming general availability. Do not change pricing, terms, trial lengths or guarantee claims without checking billing and approved commercial terms. Remove stale metadata and redirect obsolete URLs only after checking traffic, links and canonical destinations. Avoid unsupported numerical results.

## Remaining rollout
- Verify public homepage and product routes; align BloomSites and Brands in Blooms navigation/footer and technology copy.
- Add Plant Intelligence and Care Guides pages with accurate availability disclosures; create partner-only supplier page and customer journey in the existing guide layout.
- Verify all showroom routes and consent-safe Northfield care journey; do not activate pending supplier exchanges as part of marketing.
- Obtain permission and measured evidence for customer stories.
- Maintain a single versioned feature register and link it from all three repositories.
