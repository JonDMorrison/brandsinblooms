export const HERO_CONTENT = {
  eyebrow: "For independent garden centres",
  // Static second line under the rotating typewriter phrase. The first
  // line cycles through HERO_ROTATING_PHRASES below; the closer stays put.
  staticTagline: "Built For Garden Centres.",
  subtext:
    "BloomSuite gives garden centres and florists one place to manage customers, run email and SMS campaigns, build a storefront, and connect to Lightspeed, Stripe, Shopify, and Mailchimp.",
  primaryCta: "Start free trial",
  secondaryCta: "Book a demo",
  primaryHref: "/auth",
  secondaryHref: "#demo",
};

// Line-count audit. With .hp-hero__headline font-size
// clamp(1.75rem, 3vw, 2.5rem) and .hp-hero__copy width
// min(1120px, 100%), every phrase fits on a SINGLE line at every
// desktop breakpoint (>=768px) — guaranteed by white-space: nowrap on
// the rotating line. At Quicksand-900 char-width 0.5em, the 43-char
// longest phrase renders ~860px wide at the 40px font cap, well
// inside the 942px container at 1024px viewport. Mobile (<768px)
// drops white-space to normal because the floor 28px font with
// ~340px container can only fit ~24 chars per line; the longer
// phrases wrap naturally and the static "Built For Garden Centres."
// line below shifts ~36px during their type-out animation. That
// shift is the explicit mobile tradeoff (see homepageHero.css mobile
// block).
//
//   chars  phrase                                                 desktop / mobile-SE
//   32     "The most powerful marketing tool"                     1 / 2
//   31     "The CRM that's ready in minutes"                      1 / 2
//   34     "Email and SMS that send themselves"                   1 / 2
//   38     "An ecommerce storefront setup in hours"               1 / 2
//   33     "The POS-synced communication tool"                    1 / 2
//   43     "One marketing login for your whole business"          1 / 2
//   35     "Marketing built around your seasons"                  1 / 2
//   29     "Campaigns that run themselves"                        1 / 1-2
export const HERO_ROTATING_PHRASES: readonly string[] = [
  "The most powerful marketing tool",
  "The CRM that's ready in minutes",
  "Email and SMS that send themselves",
  "An ecommerce storefront setup in hours",
  "The POS-synced communication tool",
  "One marketing login for your whole business",
  "Marketing built around your seasons",
  "Campaigns that run themselves",
];
