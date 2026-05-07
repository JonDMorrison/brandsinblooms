import analyticsDashboardIllustration from "@/assets/features/analytics-dashboard.png";
import type { FeaturePageContent } from "../featurePageContent";

export const analyticsContent: FeaturePageContent = {
  slug: "analytics",
  seo: {
    title: "Analytics & Reports for Garden Centres | BloomSuite",
    description:
      "Plain-language reports built for garden centres. See what worked, what didn't, and what to do next, without dashboards to interpret or spreadsheets to build.",
    canonical: "https://www.bloomsuite.app/features/analytics",
  },
  breadcrumbLabel: "Analytics",
  hero: {
    eyebrow: "Analytics & Reports",
    headline: "Reports that tell you what's working in plain English.",
    subhead:
      "Pre-built reports that combine your POS, customer, and campaign data into clear answers. No dashboards to interpret, no spreadsheets to build, no consultant to hire.",
    illustrationSrc: analyticsDashboardIllustration,
    illustrationAlt:
      "Illustration of an analytics dashboard with a trend chart, stat blocks, and a magnifying glass with a lightbulb icon",
  },
  problem: {
    eyebrow: "The reality",
    headline:
      "Most garden centres make decisions based on memory, gut, and last year's spreadsheet.",
    pains: [
      {
        title: "Spreadsheet hell",
        description:
          "Customer data in one tab, sales in another, campaign data nowhere because the email tool doesn't export. Building one report takes a Saturday morning. Updating it takes another Saturday next month.",
      },
      {
        title: "Dashboards you don't have time to interpret",
        description:
          "Your POS shows you charts. Your email tool shows you charts. Google Analytics shows you charts. None of them tell you what to do. Most garden centre owners give up and rely on instinct.",
      },
      {
        title: "BI tools are built for someone else's business",
        description:
          "Tableau, Power BI, Looker — all powerful, all overkill for a garden centre with a few hundred customers and one location. You'd need a data analyst to use them, and you don't have a data analyst.",
      },
      {
        title: "Decisions get made without data",
        description:
          "How much should you order for spring? Which customers are about to leave? Did the Mother's Day campaign actually pay off? You usually guess, because checking takes longer than deciding.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline:
      "Reports designed for the questions garden centres actually ask.",
    subhead:
      "Five reporting capabilities that turn your data into decisions, not into more dashboards.",
    items: [
      {
        title: "Plain-language summaries",
        description:
          "Every report leads with a written summary in plain English: 'Revenue grew 14% vs last year, driven by perennials and indoor plants. The Mother's Day campaign drove $8,400 in attributed sales. Three customers from your VIP segment are showing churn signals.' Numbers below if you want to dig in.",
      },
      {
        title: "Customer behaviour reports",
        description:
          "Lifetime value by segment, churn risk indicators, customer acquisition cost by channel, repeat-visit rate by season. Pre-built and updating live, no SQL required.",
      },
      {
        title: "Sales and inventory analytics",
        description:
          "Sell-through by category, by season, by location. Top performers and dead stock. Margin analysis. Year-over-year comparisons. All sourced from POS data that's already syncing.",
      },
      {
        title: "Campaign attribution",
        description:
          "When a customer opens an email Tuesday and visits the store Saturday, that visit gets attributed to the campaign. Closed-loop ROI on every send, including in-store revenue, not just online clicks.",
      },
      {
        title: "Custom reports without SQL",
        description:
          "Filter, segment, and group any built-in report by the dimensions that matter to you. Save custom views and email them to yourself weekly. Export to CSV when you need to share. No query language to learn.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Decisions stop being guesses.",
    items: [
      {
        title: "Plan next season from real data",
        description:
          "Year-over-year reports show which categories grew, which shrank, and what drove the change. Order to match reality, not to match memory.",
      },
      {
        title: "Spot at-risk customers before they're gone",
        description:
          "Weekly churn-risk report surfaces customers showing classic departure signals: shorter visits, smaller baskets, declining email engagement. Reach out before they switch to a competitor.",
      },
      {
        title: "Know which campaigns actually paid off",
        description:
          "Stop running the same Mother's Day promo every year on faith. See which version drove the most attributable revenue and double down on what works.",
      },
    ],
  },
  integrations: {
    eyebrow: "Pulls data from",
    headline: "Already connected to everything else you use.",
    logos: [
      { name: "Lightspeed" },
      { name: "Square" },
      { name: "Shopify" },
      { name: "Mailchimp" },
      { name: "Klaviyo" },
      { name: "Google Analytics" },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real scenarios.",
    scenarios: [
      {
        title: "Quarterly business review without the spreadsheet rebuild",
        description:
          "End of every quarter, the pre-built business review report lands in your inbox. Revenue by segment, by category, by location. Top customers, at-risk customers, campaign ROI. The conversation with your team uses real data instead of recollection.",
      },
      {
        title: "Mother's Day post-mortem",
        description:
          "Two weeks after Mother's Day, the campaign report shows you which audience converted, what the average attributed basket size was, and how it compared to last year. Tune next year's send based on what worked.",
      },
      {
        title: "Weekly at-risk customer alert",
        description:
          "Every Monday, the churn-risk report flags customers whose recent behaviour suggests they're drifting. Your team can call them, send a personal email, or invite them to an event before they're a lost cause.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question: "How is this different from Google Analytics?",
        answer:
          "Google Analytics shows you website behaviour: page views, bounce rate, traffic sources. BloomSuite analytics combines that with your in-store sales, your customer history, and your campaign performance to answer business questions, not website questions.",
      },
      {
        question: "What metrics are tracked out of the box?",
        answer:
          "Revenue (in-store, online, total). Customers (active, lapsed, at-risk, new). Segments (size, growth, conversion). Campaigns (sends, opens, clicks, attributed revenue). Inventory (sell-through, top performers, slow movers). Plus seasonal comparisons across all of them.",
      },
      {
        question:
          "Can I build custom reports if the built-in ones don't fit?",
        answer:
          "Yes. The custom report builder lets you filter, segment, and group any data BloomSuite collects. Save your view, schedule it to email weekly, or export to CSV. No SQL, no joins, no data science required.",
      },
      {
        question:
          "Can I export data to a spreadsheet for further analysis?",
        answer:
          "Yes. Every report has a CSV export. The full customer list, full transaction history, full campaign engagement data — all exportable. Some larger garden centres also use our API to pull data into their own BI tools.",
      },
      {
        question: "Are reports real-time or daily?",
        answer:
          "Real-time for live dashboards (current revenue, today's transactions, active customers). Daily for the heavier aggregations (weekly summaries, monthly comparisons). Year-over-year reports recalculate nightly.",
      },
      {
        question: "How does this work for multi-location operators?",
        answer:
          "Every report can be filtered by location, viewed across locations, or rolled up. Compare locations side-by-side, identify top performers, spot under-performers. Aggregate views show the whole business; drilled-down views focus on one site.",
      },
      {
        question: "Do I need a data analyst on staff to use this?",
        answer:
          "No. The plain-language summaries are written for owners and managers, not analysts. The custom report builder is point-and-click. If you can use a spreadsheet, you can use BloomSuite analytics.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Get the most out of your data.",
    articles: [
      {
        title: "Reading your weekly business summary",
        description:
          "How to use the plain-language summary that lands in your inbox every Monday.",
        href: "/knowledge-base",
      },
      {
        title: "Spotting churn signals in your customer base",
        description:
          "Five behaviours that predict a customer is about to leave, and what to do about them.",
        href: "/knowledge-base",
      },
      {
        title: "Building a custom report",
        description:
          "Walk through building a custom report from scratch using filters, segments, and time ranges.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "What pairs well",
    headline: "Analytics is the feedback loop on everything else.",
    links: [
      {
        slug: "customer-crm",
        title: "Remember Every Customer",
        description:
          "The CRM data is what most reports are built on. Cleaner CRM data means sharper reports.",
      },
      {
        slug: "campaigns",
        title: "Send the Right Message at the Right Time",
        description:
          "Campaign analytics close the loop: see which sends drove revenue, which underperformed, and what to try next.",
      },
    ],
  },
  cta: {
    headline: "Ready to make decisions based on data, not memory?",
    subhead:
      "Start free, connect your POS, and have your first business summary in your inbox within a week.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default analyticsContent;
