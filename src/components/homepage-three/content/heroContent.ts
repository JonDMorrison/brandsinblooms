export const HERO_CONTENT = {
  eyebrow: "For independent garden centres",
  // Static second line under the rotating typewriter phrase. The first
  // line cycles through HERO_ROTATING_PHRASES below; the closer stays put.
  staticTagline: "Built For Garden Centres.",
  subtext:
    "Run your customer marketing and online sales from one platform. Spend more time on the floor, less on the laptop.",
  primaryCta: "Start free trial",
  secondaryCta: "Book a demo",
  primaryHref: "/auth",
  secondaryHref: "#demo",
};

// Line-count audit. With .hp-hero__headline font-size
// clamp(2.25rem, 4vw, 3.25rem) and .hp-hero__copy width
// min(1120px, 100%), every phrase fits on a SINGLE line at every
// desktop breakpoint (>=768px) — guaranteed by white-space: nowrap on
// the rotating line. Quicksand-900 char-width measured at ~0.52em
// (this morning's expect-cli mission). Longest phrase below is now
// 34 chars — at the 52px font ceiling that renders ~919px wide,
// inside the ~942px container at 1024px viewport with a small
// margin. Mobile (<768px) drops white-space to normal so the longer
// phrases wrap naturally; the static "Built For Garden Centres."
// line below shifts ~36px during their type-out animation. That
// shift is the explicit mobile tradeoff (see homepageHero.css mobile
// block).
//
//   chars  phrase                                                 desktop / mobile-SE
//   32     "The most powerful marketing tool"                     1 / 2
//   31     "The CRM that's ready in minutes"                      1 / 2
//   34     "Email and SMS that send themselves"                   1 / 2  ← longest
//   27     "A storefront ready in hours"                          1 / 2
//   33     "The POS-synced communication tool"                    1 / 2
//   33     "One login for your whole business"                    1 / 2
//   32     "Marketing built for your seasons"                     1 / 2
//   29     "Campaigns that run themselves"                        1 / 1-2
export const HERO_ROTATING_PHRASES: readonly string[] = [
  "The most powerful marketing tool",
  "The CRM that's ready in minutes",
  "Email and SMS that send themselves",
  "A storefront ready in hours",
  "The POS-synced communication tool",
  "One login for your whole business",
  "Marketing built for your seasons",
  "Campaigns that run themselves",
];
