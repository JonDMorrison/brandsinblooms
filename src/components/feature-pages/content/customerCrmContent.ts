import smartCrmIllustration from "@/assets/features/smart-crm.png";
import type { FeaturePageContent } from "../featurePageContent";

export const customerCrmContent: FeaturePageContent = {
  slug: "customer-crm",
  seo: {
    title: "Customer CRM for Garden Centres | BloomSuite",
    description:
      "A CRM built for garden centres. Every visit, every purchase, every preference, on one timeline. POS-synced from Lightspeed, Square, and Shopify.",
    canonical: "https://www.bloomsuite.app/features/customer-crm",
  },
  breadcrumbLabel: "Customer CRM",
  hero: {
    eyebrow: "Customer CRM",
    headline: "Remember every customer who walks through your doors.",
    subhead:
      "A CRM built specifically for garden centres. Every visit, every purchase, every preference flows into one customer record automatically. No spreadsheets, no manual data entry, no customers slipping through the cracks.",
    illustrationSrc: smartCrmIllustration,
    illustrationAlt:
      "Illustration of a customer profile card with a timeline of past visits",
  },
  problem: {
    eyebrow: "The reality",
    headline: "Most garden centres are tracking customers in their head.",
    pains: [
      {
        title: "Walk-ins disappear after the sale",
        description:
          "A customer browses the perennials, makes a purchase, and walks out. You may never reach them again. Without an easy way to capture and follow up, every sale is a one-time event.",
      },
      {
        title: "Spreadsheets and POS receipts don't add up",
        description:
          "Your customer list lives in three places: an email tool, your POS, and a notebook by the till. None of them talk. The same customer shows up three different ways.",
      },
      {
        title: "Your team can't see who's a VIP",
        description:
          "When a regular customer walks in, only one person on staff might recognize them. The rest treat them like a stranger because they have no shared customer record to look at.",
      },
      {
        title: "Marketing goes to everyone, the same way",
        description:
          "Without segmentation, the email blast about hanging baskets goes to people who only buy mulch, the BBQ promotion goes to a customer who hasn't visited in two years, and your VIPs get treated like first-time browsers.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline: "Every customer in one place, always up to date.",
    subhead:
      "Five core capabilities, designed around the way garden centres actually work.",
    items: [
      {
        title: "Unified customer profiles",
        description:
          "One record per person. Contact details, purchase history, segment membership, lifecycle stage, and notes from your team — all on a single timeline. Updated in real time as new transactions and interactions come in.",
      },
      {
        title: "Automatic POS sync",
        description:
          "Connect Lightspeed Retail, Square, or VMX once. Every transaction flows into the matching customer record automatically. New customers get created on first purchase. Existing customers get updated. No exports, no imports, no duplicates.",
      },
      {
        title: "Smart segments",
        description:
          "Group customers by what they actually do, not what you guess. VIP buyers, lapsed customers, perennial fans, birthday club, this season's first-timers — all auto-updating as customer behaviour changes.",
      },
      {
        title: "Customer timeline",
        description:
          "See every touchpoint in chronological order: every visit, every purchase, every email opened, every text replied to. Spot patterns, identify churn risk, recognize loyalty.",
      },
      {
        title: "Staff notes and tags",
        description:
          "Let your team capture context the system can't. 'Daughter just had a baby — interested in indoor plants for nursery.' 'Allergic to lavender, suggest alternatives.' Notes show up next time anyone on staff opens the customer record.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Stop guessing who your customers are.",
    items: [
      {
        title: "Recognize every regular",
        description:
          "When a customer walks in, anyone on staff can pull up their record and know what they bought last spring, what their preferences are, and what they were looking for last visit.",
      },
      {
        title: "Catch at-risk customers before they're gone",
        description:
          "Lapsed customer segments surface people who used to buy regularly but haven't visited in 60, 90, or 120 days — so you can reach out before they switch to a competitor.",
      },
      {
        title: "Send the right message to the right person",
        description:
          "When you connect campaigns to your CRM, your perennial buyers get the perennial sale, your veggie gardeners get the seedling promotion, and your VIPs get the early access — automatically.",
      },
    ],
  },
  integrations: {
    eyebrow: "Connects to",
    headline: "Plays nicely with the tools you already run.",
    logos: [
      { name: "Lightspeed Retail" },
      { name: "Square" },
      { name: "Shopify" },
      { name: "VMX POS" },
      { name: "Mailchimp" },
      { name: "Klaviyo" },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real scenarios.",
    scenarios: [
      {
        title: "Spring rush, smarter",
        description:
          "Pull up everyone who bought perennials last spring and didn't return in fall. Send them a 'spring is back' email with the new perennial stock featured. The segment auto-populates from POS data. The campaign goes out in 10 minutes.",
      },
      {
        title: "Lapsed customer recovery",
        description:
          "Identify customers who haven't visited in 90+ days but used to be regulars. Trigger an SMS with a small incentive — 15% off their next visit. Watch the return-visit rate climb in the analytics tab.",
      },
      {
        title: "VIP appreciation event",
        description:
          "Filter customers by lifetime spend over $1,000 and tag them as VIPs. Send them an exclusive invitation to a members-only twilight tour and pruning workshop. Track RSVPs and follow up with attendees.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question:
          "How is this different from a regular CRM like HubSpot or Salesforce?",
        answer:
          "Most CRMs are built for B2B sales pipelines: leads, deals, opportunities, quotes. Garden centre customers don't move through that kind of pipeline. They visit, they buy, they come back. BloomSuite's CRM is structured around customer behaviour: visits, purchases, segments, lifecycle stage. It's also POS-native, which generic CRMs are not.",
      },
      {
        question: "Will this work with my existing POS?",
        answer:
          "We support Lightspeed Retail, Square, Shopify POS, and VMX POS today, with more integrations on the way. If you use a different POS, get in touch and we'll let you know what's possible. Most modern POS systems with an API can be connected.",
      },
      {
        question: "What happens to my existing customer data?",
        answer:
          "On signup, you can import contacts from CSV, from Mailchimp or Constant Contact, or directly from your POS. Existing data merges into BloomSuite without overwriting your POS — your POS stays the source of truth for transactions, and BloomSuite is the source of truth for marketing.",
      },
      {
        question: "How long does CRM setup take?",
        answer:
          "Most garden centres are fully synced and segmented within a week. POS connection takes about 30 minutes with our team. Initial historical sync (depending on transaction volume) runs in the background and typically completes overnight. Your team can start using the CRM the next day.",
      },
      {
        question: "Can my staff add notes to customer profiles?",
        answer:
          "Yes. Anyone on your team with the right permission can leave a note on a customer record from any device. Notes are timestamped, attributed, and visible to other team members the next time they open that customer.",
      },
      {
        question: "Is customer data secure?",
        answer:
          "Yes. Data is encrypted in transit and at rest. We're hosted on enterprise infrastructure (Supabase + Vercel) with SOC 2-aligned operational practices. We never sell or share customer data. You own your customer list.",
      },
      {
        question: "Do you charge per contact?",
        answer:
          "Plans are tiered by contact volume, not per-contact. The Sprout plan supports up to 10,000 contacts; Bloom supports 25,000; Thrive is unlimited. Most single-location garden centres fit comfortably within Sprout or Bloom.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Get the most out of your CRM.",
    articles: [
      {
        title: "Setting up POS sync",
        description:
          "A step-by-step guide to connecting Lightspeed, Square, or Shopify to BloomSuite.",
        href: "/knowledge-base",
      },
      {
        title: "Building your first segment",
        description:
          "How to define a customer segment that auto-updates as your data changes.",
        href: "/knowledge-base",
      },
      {
        title: "Using customer notes effectively",
        description:
          "Best practices for capturing frontline knowledge so your whole team benefits.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "What pairs well",
    headline:
      "Customers are the foundation. Here's what builds on top.",
    links: [
      {
        slug: "campaigns",
        title: "Send the Right Message at the Right Time",
        description:
          "Use your CRM segments to send email and SMS campaigns that actually fit each customer.",
      },
      {
        slug: "analytics",
        title: "Numbers in Plain English",
        description:
          "See which segments drive the most revenue, which are at risk, and which are growing.",
      },
    ],
  },
  cta: {
    headline: "Ready to know every customer who walks in?",
    subhead:
      "Start free, sync your POS, and have your CRM populated within a week.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default customerCrmContent;
