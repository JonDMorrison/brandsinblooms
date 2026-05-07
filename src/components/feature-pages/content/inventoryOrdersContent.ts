import inventoryOrdersIllustration from "@/assets/features/inventory-orders.png";
import type { FeaturePageContent } from "../featurePageContent";

export const inventoryOrdersContent: FeaturePageContent = {
  slug: "inventory-orders",
  seo: {
    title: "Inventory & Order Sync for Garden Centres | BloomSuite",
    description:
      "Live POS sync from Lightspeed, Square, Shopify, Clover, and VMX POS. See what's selling, what's left, and what to reorder, without exports or spreadsheets.",
    canonical: "https://www.bloomsuite.app/features/inventory-orders",
  },
  breadcrumbLabel: "Inventory & Orders",
  hero: {
    eyebrow: "Inventory & Orders",
    headline: "Know exactly what's selling without leaving the dashboard.",
    subhead:
      "Connect your POS once. Every transaction, every product, every customer flows into BloomSuite live. No exports, no imports, no Sunday-night spreadsheets.",
    illustrationSrc: inventoryOrdersIllustration,
    illustrationAlt:
      "Illustration of a product shelf with garden centre products and a sync indicator connecting to a sales dashboard",
  },
  problem: {
    eyebrow: "The reality",
    headline:
      "Most garden centres are flying blind on inventory between POS reports.",
    pains: [
      {
        title: "Stock blindness during the busy season",
        description:
          "Spring rush hits. Perennials are flying off the shelves. By the time you check stock on Monday morning, the bestsellers ran out Saturday afternoon and the weekend's customers walked away.",
      },
      {
        title: "Overordering at the start of the season",
        description:
          "Without clear sell-through data from last year, you order based on memory and gut. Half of it sits in the back. The other half stocks out by week three.",
      },
      {
        title: "Manual exports to see anything useful",
        description:
          "Your POS has the data, but seeing it requires logging in, running a report, exporting to CSV, and combining it with your customer list in another tool. Most weeks it doesn't happen.",
      },
      {
        title: "Customer purchases aren't connected to anything",
        description:
          "Sarah bought a Japanese maple last spring. There's no easy way to see that, remember it, or use it to send her a relevant follow-up. The transaction lives in your POS receipts and dies there.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline:
      "Live inventory and order data, attached to the right customer, ready for marketing.",
    subhead:
      "Five capabilities that turn raw POS data into the picture of your business you've been wanting.",
    items: [
      {
        title: "Real-time POS sync",
        description:
          "Connect Lightspeed Retail, Square, Shopify, Clover, or VMX POS once. Every transaction flows into BloomSuite within minutes. New products auto-create. Inventory levels update live. No exports, no batch imports.",
      },
      {
        title: "Multi-location inventory",
        description:
          "Run two stores or twenty. See inventory by location, in aggregate, or filtered to a single SKU across all sites. Move stock, adjust pricing, run location-specific promotions, all from one workspace.",
      },
      {
        title: "Low-stock alerts",
        description:
          "Set thresholds per product or category. Get an email or Slack ping when bestsellers dip below your reorder point. Catch stockouts before they happen during the spring rush.",
      },
      {
        title: "Sell-through reporting",
        description:
          "Plain-language reports on what's moving, what's sitting, and what's gone. Filter by season, by category, by margin, by location. Plan next year's order based on this year's actual data, not memory.",
      },
      {
        title: "Customer-attached purchases",
        description:
          "Every transaction lands on the buying customer's record automatically. Sarah's Japanese maple, John's mulch order, Maria's hanging baskets — all on their respective profiles, available to your team and to your campaigns.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Stop guessing what's in stock and what your customers bought.",
    items: [
      {
        title: "Reorder before stockout, not after",
        description:
          "See the perennials moving fast Friday morning, place the reorder Friday afternoon, and have stock on the floor for next weekend's rush.",
      },
      {
        title: "Plan next season from real data",
        description:
          "Year-over-year sell-through reports show what worked and what didn't. Order to match reality, not to match what you ordered last year.",
      },
      {
        title: "Marketing that knows what each customer bought",
        description:
          "Segments built on actual purchase history mean your perennial buyers get the perennial sale and your veggie gardeners get the seedling promo, automatically.",
      },
    ],
  },
  integrations: {
    eyebrow: "Connects to",
    headline: "Plays nicely with the POS you already run.",
    logos: [
      { name: "Lightspeed" },
      { name: "Square" },
      { name: "Clover" },
      { name: "VMX POS" },
      { name: "Shopify" },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real scenarios.",
    scenarios: [
      {
        title: "Spring stockout prevention",
        description:
          "Set low-stock alerts on your top-selling perennials in early April. When sell-through accelerates the first warm weekend, you get pinged Friday morning and reorder before Saturday's rush. No empty shelves at peak demand.",
      },
      {
        title: "End-of-season clearance",
        description:
          "Late August, sell-through reports surface the slow-moving SKUs that won't make it through fall. Build a clearance segment of customers who buy similar items, send a targeted offer, move the stock before it dies in the back room.",
      },
      {
        title: "VIP recognition with purchase history",
        description:
          "Your top buyer walks in. Anyone on staff pulls up her record and sees she bought $850 of perennials last spring and a Japanese maple in June. The conversation that follows is informed, personal, and converts.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question: "Which POS systems do you support?",
        answer:
          "Today: Lightspeed Retail, Square, Shopify POS, Clover, and VMX POS. More integrations are in development. If you use a different POS with an API, get in touch and we'll let you know what's possible.",
      },
      {
        question: "How fast does inventory sync update?",
        answer:
          "Most POS systems sync within 1-5 minutes of a transaction. Lightspeed and Square sync in near real-time. VMX POS syncs every 15 minutes. Stock levels update as fast as your POS reports them.",
      },
      {
        question: "Will BloomSuite change my product catalog or prices?",
        answer:
          "No. Your POS stays the source of truth for products, pricing, and inventory levels. BloomSuite reads, never writes. Changes you make in your POS show up in BloomSuite. Changes nobody makes in BloomSuite show up in your POS.",
      },
      {
        question: "How does this handle multiple locations?",
        answer:
          "Each location's POS connects independently. BloomSuite shows inventory per-location and aggregated. Campaigns can target customers by their primary location, by visited locations, or across all of them.",
      },
      {
        question: "Can I import historical sales data?",
        answer:
          "Yes. The initial sync pulls 12-24 months of historical transactions (depending on your POS) so segments and reports have data from day one. Some POS systems allow longer history; we'll pull as far back as available.",
      },
      {
        question: "What happens if my POS goes down?",
        answer:
          "BloomSuite continues running on the most recent synced data. When your POS comes back online, sync resumes from where it left off. No data loss, no manual reconciliation.",
      },
      {
        question: "Do you charge per transaction synced?",
        answer:
          "No. Plans are tiered by contact volume, not transactions. Sync as many transactions as your POS produces. Burnett's Country Gardens, an early customer, syncs over 220,000 receipts on the standard Bloom plan.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Get the most out of your POS connection.",
    articles: [
      {
        title: "Connecting Lightspeed, Square, or Shopify to BloomSuite",
        description: "Step-by-step guide to your first POS connection.",
        href: "/knowledge-base",
      },
      {
        title:
          "Setting low-stock alerts that actually trigger at the right time",
        description:
          "Calibrate alerts to your sales velocity so you reorder before stockouts.",
        href: "/knowledge-base",
      },
      {
        title: "Reading your sell-through report",
        description:
          "How to use sell-through data to plan next season's orders.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "What pairs well",
    headline: "Inventory data fuels everything else.",
    links: [
      {
        slug: "analytics",
        title: "Numbers in Plain English",
        description:
          "Sell-through reports, revenue trends, and margin analysis built from the same POS data.",
      },
      {
        slug: "storefront",
        title: "A Storefront That Sells for You",
        description:
          "Your POS products auto-populate your online storefront. Inventory updates everywhere when something sells.",
      },
    ],
  },
  cta: {
    headline: "Ready to see your inventory and customers in one place?",
    subhead:
      "Connect your POS in 30 minutes. See your first sell-through report by tomorrow.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default inventoryOrdersContent;
