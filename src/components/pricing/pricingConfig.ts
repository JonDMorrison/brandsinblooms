import { Leaf, Sprout, Flower2, TreeDeciduous } from "lucide-react";

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  description: string;
  includes: {
    emails: string;
    sms: string;
    website?: boolean;
  };
  overages: {
    emails: string;
    sms: string;
  };
  bestFor: string;
  recommended?: boolean;
  icon: typeof Leaf;
}

export const pricingTiers: PricingTier[] = [
  {
    id: "seed",
    name: "Seed",
    price: 199,
    description: "CRM, messaging, automations, and insights",
    includes: {
      emails: "10,000 emails/month",
      sms: "1,000 SMS/month",
      website: false,
    },
    overages: {
      emails: "$0.002/email",
      sms: "$0.03/SMS",
    },
    bestFor: "Garden centres with an existing website who want BloomSuite CRM, messaging, automations, and insights.",
    icon: Leaf,
  },
  {
    id: "sprout",
    name: "Sprout",
    price: 349,
    description: "Website + Ecommerce + BloomSuite",
    includes: {
      emails: "20,000 emails/month",
      sms: "2,000 SMS/month",
      website: true,
    },
    overages: {
      emails: "$0.002/email",
      sms: "$0.03/SMS",
    },
    bestFor: "Small to medium garden centres with 5,000 to 10,000 contacts.",
    icon: Sprout,
  },
  {
    id: "bloom",
    name: "Bloom",
    price: 699,
    description: "Website + Ecommerce + BloomSuite",
    includes: {
      emails: "100,000 emails/month",
      sms: "5,000 SMS/month",
      website: true,
    },
    overages: {
      emails: "$0.002/email",
      sms: "$0.03/SMS",
    },
    bestFor: "Medium to large garden centres with 10,000 to 25,000 contacts or heavy SMS usage.",
    recommended: true,
    icon: Flower2,
  },
  {
    id: "thrive",
    name: "Thrive",
    price: 1199,
    description: "Website + Ecommerce + BloomSuite",
    includes: {
      emails: "Unlimited emails",
      sms: "50,000 SMS/month (Fair Use)",
      website: true,
    },
    overages: {
      emails: "Included",
      sms: "Only for extraordinary overuse",
    },
    bestFor: "Multi-location or high-volume retailers requiring advanced automation and unlimited communication.",
    icon: TreeDeciduous,
  },
];

export const futurePricing = [
  { tier: "Seed", intro: 199, future: 299 },
  { tier: "Sprout", intro: 349, future: 499 },
  { tier: "Bloom", intro: 699, future: 999 },
  { tier: "Thrive", intro: 1199, future: 1999 },
];

export const allPlansFeatures = [
  { label: "Garden centre-specific CRM", icon: "Users" },
  { label: "Segmentation & prebuilt customer personas", icon: "Target" },
  { label: "Automated campaigns for events & seasons", icon: "CalendarClock" },
  { label: "Email & SMS scheduling", icon: "Send" },
  { label: "Website integration", icon: "Globe" },
  { label: "Analytics & reporting", icon: "BarChart3" },
  { label: "Brand Bloom Community access", icon: "Users2" },
  { label: "Ongoing updates & new features", icon: "Sparkles" },
];

export const pricingFaqs = [
  {
    question: "What counts as an email or SMS in my usage?",
    answer: "Each individual email or SMS message sent to a recipient counts as one unit. For example, sending a campaign to 1,000 contacts counts as 1,000 emails. Transactional emails like password resets are also counted.",
  },
  {
    question: "What happens if I go over my included limits?",
    answer: "You'll be charged at the overage rates listed for your plan. We'll notify you when you reach 80% and 100% of your limits. You can also upgrade your plan at any time to get more included volume.",
  },
  {
    question: "Can I switch plans as my garden centre grows?",
    answer: "Absolutely! You can upgrade or downgrade your plan at any time. When you upgrade, you'll get immediate access to your new limits. If you downgrade, the change takes effect at your next billing cycle.",
  },
  {
    question: "Do I keep my introductory pricing forever if I join now?",
    answer: "Yes! Founding customers who join during the Launch Program are locked into their introductory pricing for life, as long as their subscription remains active.",
  },
  {
    question: "Does BloomSuite integrate with my existing website or POS?",
    answer: "BloomSuite integrates with popular POS systems including Square and Lightspeed. For websites, our Sprout tier and above include a fully managed website, or we can integrate with your existing site.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! We offer a 14-day free trial with full access to all features. No credit card required to start.",
  },
];
