import campaignBuilderIllustration from "@/assets/features/campaign-builder.png";
import type { FeaturePageContent } from "../featurePageContent";

export const campaignsContent: FeaturePageContent = {
  slug: "campaigns",
  seo: {
    title: "Email & SMS Campaigns for Garden Centres | BloomSuite",
    description:
      "AI-drafted email and SMS campaigns built for garden centres. Segment by purchase behaviour, schedule around your busy season, and run the same playbook every year.",
    canonical: "https://www.bloomsuite.app/features/campaigns",
  },
  breadcrumbLabel: "Campaigns",
  hero: {
    eyebrow: "Email & SMS Campaigns",
    headline: "Send the right message to the right customer at the right time.",
    subhead:
      "AI drafts the email, your CRM picks the audience, and BloomSuite sends it when your customers actually open. Set up your seasonal playbook once and run it every year.",
    illustrationSrc: campaignBuilderIllustration,
    illustrationAlt:
      "Illustration of an envelope opening to reveal a chart, surrounded by phone notifications and a calendar",
  },
  problem: {
    eyebrow: "The reality",
    headline:
      "Most garden centres send the same email to everyone, once a quarter, hoping it lands.",
    pains: [
      {
        title: "Marketing eats your week",
        description:
          "Drafting an email, picking an audience, building the list, scheduling the send. By the time it's out, the moment has passed and you're already behind on next week's promotion.",
      },
      {
        title: "Generic blasts don't convert",
        description:
          "When the same email goes to your VIP buyer, your seasonal browser, and your one-time walk-in, none of them feel spoken to. Open rates drop. Unsubscribes climb.",
      },
      {
        title:
          "Segmentation is supposed to be the answer, but nobody has time",
        description:
          "You know you should send different messages to different customers. You also know it takes hours to build segments in most tools. So you don't, and back to generic blasts.",
      },
      {
        title: "SMS feels risky and you're not sure how to use it",
        description:
          "Texting customers feels personal, which is good, until you wonder about CASL, opt-outs, timing, and what to even say. Most garden centres skip it entirely.",
      },
    ],
  },
  capabilities: {
    eyebrow: "What you get",
    headline:
      "Marketing that runs itself, the way you'd run it if you had time.",
    subhead:
      "Five capabilities that make 'send the right message at the right time' actually achievable for a small team.",
    items: [
      {
        title: "AI drafts every email and SMS",
        description:
          "Tell BloomSuite what you want to send (a Mother's Day perennial promo, a lapsed customer offer, a clearance event) and the AI drafts the copy, the subject line, and the call to action. Edit, approve, send. Drafting that took an hour now takes five minutes.",
      },
      {
        title: "Segments built from your customer data",
        description:
          "Pick from pre-built segments (VIPs, lapsed, this season's customers, birthday club) or build your own from any combination of purchase history, lifecycle stage, contact preferences, or location. Segments auto-update as customers behave differently.",
      },
      {
        title: "Send-time optimization",
        description:
          "BloomSuite knows when each customer is most likely to open. Schedule a campaign for 'best time' and each recipient gets it when they're paying attention, not when you happened to click send.",
      },
      {
        title: "Annual playbook automation",
        description:
          "Build a campaign once and tag it for an annual recurrence. Mother's Day perennial promo runs every year. Lapsed customer recovery runs continuously. Birthday club fires on each customer's birthday. Set it up, walk away, watch it work.",
      },
      {
        title: "Email and SMS in one place",
        description:
          "Decide message-by-message whether email, SMS, or both makes sense. CASL-compliant opt-in flows, automatic unsubscribe handling, deliverability monitoring, and built-in templates that look right on every device.",
      },
    ],
  },
  outcomes: {
    eyebrow: "What changes",
    headline: "Marketing that produces results without producing burnout.",
    items: [
      {
        title: "Stop drafting from scratch every week",
        description:
          "AI drafts in seconds. Your team edits and approves. The hours you used to spend writing copy go back to running the store.",
      },
      {
        title: "Higher open rates, fewer unsubscribes",
        description:
          "Right message, right person, right time. Customers feel spoken to instead of blasted. Engagement goes up. List health stays strong.",
      },
      {
        title: "Recurring revenue from automated flows",
        description:
          "Birthday club, lapsed recovery, post-purchase follow-up — all running in the background, every day, without your involvement.",
      },
    ],
  },
  integrations: {
    eyebrow: "Sends through",
    headline: "Use your existing email and SMS infrastructure, or ours.",
    logos: [
      { name: "Mailchimp" },
      { name: "Klaviyo" },
      { name: "Constant Contact" },
      { name: "Meta" },
    ],
  },
  useCases: {
    eyebrow: "How garden centres use this",
    headline: "Three real campaigns.",
    scenarios: [
      {
        title: "Mother's Day perennials, every year",
        description:
          "Pull every customer who bought perennials last spring, AI drafts the email featuring this year's hanging baskets and patio planters, send Wednesday afternoon before Mother's Day. Set it up once. Runs the same week every year, automatically.",
      },
      {
        title: "Lapsed customer SMS recovery",
        description:
          "Customers who haven't visited in 90+ days get a single SMS with a small return incentive. Quiet, personal, effective. Opt-outs handled automatically. Tracks return-visit rate so you can prove it's working.",
      },
      {
        title: "Birthday club, fully automated",
        description:
          "Every customer with a birthday in their profile gets an SMS or email a week before, offering 15% off their birthday-month visit. Configure it once. It runs forever, driving recurring small-ticket visits without any monthly effort.",
      },
    ],
  },
  faq: {
    eyebrow: "Common questions",
    headline: "Frequently asked.",
    items: [
      {
        question: "How does AI drafting actually work?",
        answer:
          "You tell BloomSuite what the campaign is for (audience, season, offer) and the AI generates a draft email or SMS in your brand voice. The first time, you tune the voice and tone. After that, every draft picks up where the last one left off. You can edit anything, regenerate, or rewrite from scratch.",
      },
      {
        question: "Can I edit the AI drafts before they go out?",
        answer:
          "Always. Every draft lands in a normal editor. You can change a word, rewrite a paragraph, or scrap it entirely and start over. AI is the starting point, not the final word.",
      },
      {
        question: "Is this CASL-compliant for Canadian garden centres?",
        answer:
          "Yes. BloomSuite handles consent records, unsubscribe links, and the express/implied consent distinctions Canadian Anti-Spam Legislation requires. Every email and SMS includes the legally required identifiers and opt-out paths automatically.",
      },
      {
        question: "What's the cost per email or SMS?",
        answer:
          "Email is included up to your plan's monthly limit (Sprout: 20K emails, Bloom: 100K, Thrive: unlimited). SMS is metered separately because of carrier costs — Sprout includes 2K sends per month, Bloom 5K, Thrive 50K. Overage rates are below standard SMS gateway pricing.",
      },
      {
        question: "Can I import my existing customer list and email history?",
        answer:
          "Yes. Import contacts from Mailchimp, Klaviyo, Constant Contact, CSV, or directly from your POS. Existing engagement data (opens, clicks, purchase history) imports too where available, so segments work from day one.",
      },
      {
        question:
          "What about deliverability? Will my emails land in inboxes?",
        answer:
          "BloomSuite uses authenticated sending domains (SPF, DKIM, DMARC) and reputation-managed IPs. We monitor bounce rates and engagement quality on your behalf, and pause domains showing deliverability issues before Gmail or Outlook penalize you.",
      },
      {
        question:
          "Do you have templates, or do I have to design every email?",
        answer:
          "Twenty-plus templates designed specifically for garden centres (seasonal sale, new arrivals, event invitation, lapsed customer recovery, post-purchase thank you, etc.) come built in. AI fills in the copy. You drop in product images and hit send.",
      },
    ],
  },
  knowledgeBase: {
    eyebrow: "Learn more",
    headline: "Run smarter campaigns.",
    articles: [
      {
        title: "Building your first AI-drafted campaign",
        description:
          "Walk through your first AI-drafted email from prompt to send.",
        href: "/knowledge-base",
      },
      {
        title: "CASL compliance for garden centre marketing",
        description:
          "What Canadian garden centres need to know about consent, opt-outs, and record-keeping.",
        href: "/knowledge-base",
      },
      {
        title: "Setting up an annual campaign playbook",
        description:
          "Build the four campaigns every garden centre should run every year.",
        href: "/knowledge-base",
      },
    ],
  },
  related: {
    eyebrow: "What pairs well",
    headline:
      "Campaigns work better when the rest of the platform feeds them.",
    links: [
      {
        slug: "customer-crm",
        title: "Remember Every Customer",
        description:
          "The segments your campaigns send to come from your CRM. The two were built to work together.",
      },
      {
        slug: "analytics",
        title: "Numbers in Plain English",
        description:
          "See which campaigns drove revenue, which underperformed, and what to try next time.",
      },
    ],
  },
  cta: {
    headline: "Ready to send marketing that actually fits each customer?",
    subhead:
      "Start free, draft your first campaign in five minutes, and have your seasonal playbook running by next week.",
    primaryLabel: "Start Free Trial",
    primaryHref: "/auth",
    secondaryLabel: "Book a Demo",
    secondaryHref: "/contact",
  },
};

export default campaignsContent;
