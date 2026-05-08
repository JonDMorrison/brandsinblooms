import pageEditorIllustration from "@/assets/features/page-editor.png";
import type { FeaturePageContent } from "../featurePageContent";

export const storefrontContent: FeaturePageContent = {
  slug: "storefront",
  seo: {
    title: "Online Storefront for Garden Centres | BloomSuite",
    description:
      "A drag-and-drop ecommerce site built for garden centres. Your branding, your products, pickup or delivery, and no separate platform fees.",
    canonical: "https://www.bloomsuite.app/features/storefront",
  },
  breadcrumbLabel: "Online Storefront",
  hero: {
    eyebrow: "Online Storefront",
    headline: "An ecommerce site that sells while you're closing up the store.",
    subhead:
      "A drag-and-drop online storefront built specifically for garden centres. Your products auto-populate from your POS. Customers pick up or get delivery. You publish in days, not months, without a web developer.",
    illustrationSrc: pageEditorIllustration,
    illustrationAlt:
      "Illustration of a browser window showing an ecommerce site with product cards and a phone displaying the same site responsively",
  },
  problem: {
    eyebrow: "The reality",
    headline:
      "Most garden centres either don't sell online or are paying too much for the privilege.",
    pains: [
      {
        title: "Building a website is its own full-time job",
        description:
          "Web developers are expensive. Templates look generic. Adding products, updating prices, and keeping inventory accurate takes hours every week. Most owners give up and let the site go stale.",
      },
      {
        title:
          "Ecommerce platforms charge another fee on top of everything else",
        description:
          "Shopify, BigCommerce, WooCommerce — all great tools, all another monthly bill, all another system to manage on top of your POS, your CRM, and your email tool. The bills compound.",
      },
      {
        title: "Your existing site doesn't talk to your POS",
        description:
          "When you sell something online, your in-store inventory doesn't update. When something sells out in store, your online catalog still shows it as available. Customers order what isn't there. You explain. Nobody's happy.",
      },
      {
        title: "Local pickup and delivery aren't really supported",
        description:
          "Garden centres aren't shipping perennials across the country. You need curbside pickup, local delivery, in-store reservations. Generic ecommerce platforms treat these as afterthoughts.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline: "An online store that fits the way garden centres actually sell.",
    subhead:
      "Five capabilities that take you from no online presence to taking orders, fast.",
    items: [
      {
        title: "Drag-and-drop page builder",
        description:
          "Build your homepage, product pages, category pages, and event pages with a visual editor. No HTML, no theme code, no developer. Add a section, drag it where you want it, change the copy, publish.",
      },
      {
        title: "Products sync from your POS automatically",
        description:
          "Connect your POS once and your product catalog populates itself. Prices, descriptions, images, inventory levels — all imported and kept current. Sell something in-store and the online catalog updates within minutes.",
      },
      {
        title: "Pickup, delivery, or both",
        description:
          "Toggle which fulfillment options you offer. In-store pickup with time slots. Local delivery within a radius you set. Reserve-now-pay-later for big-ticket plants. Delivery zones, fees, and rules are all configurable.",
      },
      {
        title: "Built-in payment processing",
        description:
          "Customers pay online with credit card or digital wallet, securely processed and routed to your bank. No separate payment platform to set up, no extra integration to maintain.",
      },
      {
        title: "Branded, mobile-first, SEO-ready",
        description:
          "Every storefront uses your colors, your logo, and your product photography. Mobile-optimized by default. Page titles, meta descriptions, and structured data are generated automatically so Google can find your products.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Selling online stops being a project and starts being a Tuesday.",
    items: [
      {
        title: "Launch in days, not months",
        description:
          "Connect your POS Monday morning, customize your homepage Tuesday, publish Wednesday. Your first online order can land Thursday.",
      },
      {
        title: "Cancel your separate ecommerce platform",
        description:
          "If you're paying $79-$299/month for Shopify, BigCommerce, or a custom site, that's gone. Your storefront is included in your BloomSuite plan.",
      },
      {
        title: "Sell while you sleep",
        description:
          "Your store is open 24/7. Customers browse, build carts, and check out at midnight or 6am. Pickup orders are ready when your team arrives. New revenue you weren't capturing before.",
      },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real scenarios.",
    scenarios: [
      {
        title: "Curbside pickup launch in 48 hours",
        description:
          "Friday afternoon decision to start offering curbside pickup. Saturday: connect POS, customize homepage, configure pickup time slots. Sunday: announce to customers via email. Monday morning: first pickup orders waiting at the till.",
      },
      {
        title: "Spring sale event page",
        description:
          "Annual May long weekend sale. Build a temporary event page with featured products, custom URL, countdown timer. Drive traffic via your campaign tool. Take preorders before the sale, fulfill on-site over the long weekend.",
      },
      {
        title: "Gift card program",
        description:
          "Sell digital and physical gift cards online year-round. Customers buy them as gifts, recipients redeem them in-store or online. Captures revenue from people who'd otherwise leave empty-handed because they don't know what to buy.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question: "Do I still need a separate website?",
        answer:
          "No. Your BloomSuite storefront is your website. Domain, design, content pages, blog, ecommerce — all in one place. If you have an existing domain, you point it at BloomSuite and the transition is invisible to your customers.",
      },
      {
        question: "Can I migrate from my existing Shopify or WordPress site?",
        answer:
          "Yes. We import your products (or sync them from your POS), redirect your old URLs to maintain SEO, and copy over your content pages. Most migrations complete in 2-4 weeks depending on site complexity.",
      },
      {
        question: "How does SEO compare to a custom-built site?",
        answer:
          "Storefronts ship with SEO best practices baked in: server-rendered pages, structured data, automatic sitemaps, optimized page speed, mobile-first design. Most garden centres see SEO improve, not regress, after switching.",
      },
      {
        question: "What about the mobile experience?",
        answer:
          "Mobile-first design throughout. Most garden centre traffic is mobile, so storefronts are optimized for phones first and desktops second. Touch-friendly product browsing, one-thumb checkout, optimized image loading.",
      },
      {
        question: "How is online payment processed?",
        answer:
          "Payments are processed securely through PCI-compliant infrastructure. You connect your bank account during setup, transactions land in your account in 1-2 business days, and processing fees are competitive with Shopify Payments and Square Online.",
      },
      {
        question: "Can I use my own domain?",
        answer:
          "Yes. Connect your existing domain (yourgardencentre.com) or buy a new one through us. SSL certificates are included and auto-renewed. Your storefront lives at your brand, not at a subdomain of ours.",
      },
      {
        question:
          "What if I want a custom design beyond drag-and-drop?",
        answer:
          "The drag-and-drop editor handles 90% of needs. For deeper customization, you can edit CSS, add custom HTML blocks, or work with our team for fully custom design. Most garden centres never need that level of control.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Build a storefront that sells.",
    articles: [
      {
        title: "Setting up your storefront from scratch",
        description:
          "Walk through your first storefront launch from POS connect to public URL.",
        href: "/knowledge-base",
      },
      {
        title: "Configuring pickup and delivery zones",
        description:
          "How to set up the fulfillment options that fit your area and team.",
        href: "/knowledge-base",
      },
      {
        title: "Driving traffic to your online store",
        description:
          "Use campaigns and SEO to bring customers to your storefront after launch.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "What pairs well",
    headline: "A storefront is one piece of a connected platform.",
    links: [
      {
        slug: "inventory-orders",
        title: "Know What's Selling, Live",
        description:
          "Your POS catalog auto-populates the storefront. Inventory updates everywhere when something sells, in-store or online.",
      },
      {
        slug: "campaigns",
        title: "Send the Right Message at the Right Time",
        description:
          "Drive traffic to the storefront with email and SMS campaigns that segment by online vs in-store buying behaviour.",
      },
    ],
  },
  cta: {
    headline: "Ready to start selling online without the platform tax?",
    subhead:
      "Launch your storefront in days. Cancel your separate ecommerce subscription.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default storefrontContent;
