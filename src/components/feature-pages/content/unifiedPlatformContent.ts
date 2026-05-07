import multiStoreIllustration from "@/assets/features/multi-store.png";
import type { FeaturePageContent } from "../featurePageContent";

export const unifiedPlatformContent: FeaturePageContent = {
  slug: "unified-platform",
  seo: {
    title: "All-in-One Marketing Platform for Garden Centres | BloomSuite",
    description:
      "One platform for your CRM, campaigns, inventory, storefront, and analytics. No tab-switching, no separate bills, no data silos.",
    canonical: "https://www.bloomsuite.app/features/unified-platform",
  },
  breadcrumbLabel: "Unified Platform",
  hero: {
    eyebrow: "Single Login, Many Features",
    headline: "One platform. One login. One bill.",
    subhead:
      "Replace four or five disconnected tools with one platform built for garden centres. Customer data, campaigns, inventory, storefront, and analytics share the same source of truth and live behind a single login.",
    illustrationSrc: multiStoreIllustration,
    illustrationAlt:
      "Illustration of a central dashboard with five orbiting feature tiles connected by clean lines, representing a unified platform",
  },
  problem: {
    eyebrow: "The reality",
    headline:
      "Most garden centres are running marketing on a stack of disconnected tools.",
    pains: [
      {
        title: "Tool sprawl",
        description:
          "A POS, a CRM, an email tool, a website builder, an analytics dashboard, a social scheduler. Four to six logins, four to six bills, four to six things to learn and maintain. The bill compounds, the complexity compounds.",
      },
      {
        title: "Data silos",
        description:
          "Customer info in your POS doesn't talk to your email tool. Email engagement doesn't show up in your CRM. Online orders don't update in-store inventory. Each system has its own truth, and none of them agree.",
      },
      {
        title: "Integration debt",
        description:
          "Connecting these tools requires Zapier, custom webhooks, or a part-time developer. Integrations break. Sync fails. You spend Saturday afternoons fixing what was supposed to fix itself.",
      },
      {
        title: "Training your team takes forever",
        description:
          "Every new hire learns five different tools, five different logins, five different ways to find a customer. Most never get good at all five. Frontline knowledge stays in heads, not systems.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline:
      "Everything in one place, built to work together from day one.",
    subhead:
      "Five capabilities that come from being a single platform, not a stack of integrations.",
    items: [
      {
        title: "Shared customer data across every feature",
        description:
          "Your CRM is your campaign audience is your storefront customer list is your analytics customer base. One record per person, used everywhere. No syncing, no mismatches, no duplicates.",
      },
      {
        title: "Single login for your whole team",
        description:
          "Owner, manager, marketer, frontline staff — everyone uses the same login and sees the parts of BloomSuite their role needs. Role-based permissions keep sensitive data restricted while letting everyone do their job.",
      },
      {
        title: "One bill instead of five",
        description:
          "Your CRM, email and SMS, ecommerce platform, analytics, and storefront in one monthly subscription. Most garden centres save $200-$500/month consolidating onto BloomSuite vs paying for the equivalent stack of separate tools.",
      },
      {
        title: "Connected workflows out of the box",
        description:
          "A customer buys a Japanese maple in-store. Their CRM record updates. The 'high-value buyer' segment auto-includes them. Next month's perennial campaign skips them because they bought big this season. The post-purchase thank-you email goes out automatically. None of it required configuration.",
      },
      {
        title: "All features included, not unlocked",
        description:
          "Sprout, Bloom, and Thrive plans all include every feature: CRM, campaigns, inventory, storefront, analytics. Plans differ in capacity (contacts, monthly emails, locations), not in functionality. You're never blocked from a feature because you're on the wrong tier.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Stop running marketing on a Frankenstein stack.",
    items: [
      {
        title: "Cancel four or five other subscriptions",
        description:
          "Your CRM, your email tool, your ecommerce platform, your analytics — all replaced. Save the monthly cost. Reclaim the mental space.",
      },
      {
        title: "Train your team in days, not months",
        description:
          "One platform, one interface, one set of conventions. New hires get productive faster. Cross-training is easier. Frontline staff can do more without escalating to the owner.",
      },
      {
        title: "No more 'why doesn't my data match?'",
        description:
          "When everything lives in one place, the question disappears. Your customer count is your customer count. Your revenue is your revenue. No reconciliation, no debate.",
      },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real scenarios.",
    scenarios: [
      {
        title: "Greenfield garden centre, new build",
        description:
          "Opening a new garden centre from scratch. Pick BloomSuite as the entire stack from day one — POS integration, CRM, campaigns, storefront, analytics. No legacy systems to migrate, no integrations to build. Up and selling within a month.",
      },
      {
        title: "Legacy stack consolidation",
        description:
          "Established garden centre running Mailchimp + HubSpot + Shopify + Google Analytics + a paper ledger. Migrate to BloomSuite over a quarter, one feature at a time. By the end, four invoices become one and the data finally connects.",
      },
      {
        title: "Multi-location operator unification",
        description:
          "Three garden centres, each with their own systems, none of them talking. Consolidate onto BloomSuite. One workspace, three locations, shared customer data, location-aware campaigns, role-based access for site managers.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question: "What tools does BloomSuite typically replace?",
        answer:
          "Most customers replace four to six tools: a CRM (like HubSpot or Salesforce), an email tool (like Mailchimp or Klaviyo), an SMS tool (like Attentive or Postscript), an ecommerce platform (like Shopify or BigCommerce), an analytics tool (like Google Analytics or a BI dashboard), and sometimes a social scheduler. The exact mix depends on what you're running today.",
      },
      {
        question: "How does pricing compare to the sum of those tools?",
        answer:
          "Almost always less. A typical garden centre running Mailchimp ($85/mo) + HubSpot CRM ($45/mo) + Shopify ($79/mo) + a basic analytics tool ($30/mo) is paying $239/month for a partial stack. The equivalent BloomSuite Bloom plan is $199/month all-in, with deeper integration than any of those tools provide individually.",
      },
      {
        question: "What's the migration path from my existing tools?",
        answer:
          "Most migrations happen in phases. Week 1: POS connection and customer data import. Week 2-3: campaigns migrate from your old email tool. Week 4-6: storefront migration if you have an existing site. Most garden centres are fully on BloomSuite within 6-8 weeks, with all systems running in parallel during the transition so nothing breaks.",
      },
      {
        question:
          "What about my custom integrations or third-party tools?",
        answer:
          "BloomSuite's API supports custom integrations to anything that matters. Webhooks let you push data to external systems. We integrate natively with Lightspeed, Square, Shopify, Clover, VMX POS, Mailchimp, Klaviyo, Constant Contact, Meta, and Google Analytics. If you need something else connected, our team can help.",
      },
      {
        question: "How do roles and permissions work?",
        answer:
          "Built-in roles cover most needs: Owner (full access), Manager (everything except billing), Marketer (campaigns and CRM, no inventory), Frontline (customer lookup and notes, read-only on the rest). Custom roles available for specific permission combinations.",
      },
      {
        question:
          "Can I add my whole team without per-seat charges?",
        answer:
          "Plans include unlimited team members within reasonable use. Sprout supports up to 5 team members, Bloom up to 15, Thrive unlimited. Most garden centres never hit the limit on Bloom.",
      },
      {
        question: "What happens to my data if I cancel?",
        answer:
          "Your data is yours. Full export of customers, transactions, campaign history, and content available at any time as CSV or via API. After cancellation, data is retained for 90 days in case you change your mind, then deleted permanently.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Make the most of one platform.",
    articles: [
      {
        title: "Migrating from a stack of separate tools",
        description:
          "A phase-by-phase guide to consolidating onto BloomSuite without disrupting operations.",
        href: "/knowledge-base",
      },
      {
        title: "Setting up team roles and permissions",
        description:
          "Configure access for owners, managers, marketers, and frontline staff.",
        href: "/knowledge-base",
      },
      {
        title: "Connecting external tools via API and webhooks",
        description:
          "Extend BloomSuite by pushing data to or pulling data from systems we don't natively integrate with.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "Where to go next",
    headline: "The features that live inside the platform.",
    links: [
      {
        slug: "customer-crm",
        title: "Remember Every Customer",
        description:
          "The customer data foundation that every other feature builds on.",
      },
      {
        slug: "campaigns",
        title: "Send the Right Message at the Right Time",
        description:
          "Marketing automation powered by the same customer data, with no separate email tool to maintain.",
      },
    ],
  },
  cta: {
    headline: "Ready to consolidate onto one platform?",
    subhead:
      "Start free, replace your stack one feature at a time, and have your monthly software bill cut in half by quarter's end.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default unifiedPlatformContent;
