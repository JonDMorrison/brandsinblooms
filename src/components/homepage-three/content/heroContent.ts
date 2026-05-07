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

// Line-count audit (verified live with expect-cli at 1280px and 375px):
// At 1280px viewport with .hp-hero__copy width 1120px and
// .hp-hero__headline font-size clamp(2.25rem, 4.5vw, 4rem) = 57.6px,
// every phrase wraps to AT MOST 2 lines. At 375px iPhone SE with the
// font floored at 36px and container ~343px, the 35/38/43-char
// phrases wrap to 3 lines — the rotating-line min-height jumps to
// 3.4em on viewports ≤767px so all three render fully without being
// clipped by overflow:hidden, and the subhead + CTAs + banner below
// stay anchored regardless of which phrase is being typed.
//
//   chars  phrase                                                 1280px / 375px
//   32     "The most powerful marketing tool"                     1 / 2
//   31     "The CRM that's ready in minutes"                      1 / 2
//   34     "Email and SMS that send themselves"                   1 / 2
//   38     "An ecommerce storefront setup in hours"               2 / 3
//   33     "The POS-synced communication tool"                    1 / 2
//   43     "One marketing login for your whole business"          2 / 3
//   35     "Marketing built around your seasons"                  1 / 3
//   29     "Campaigns that run themselves"                        1 / 2
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
