export type TestimonialEntryDirection = "left" | "center" | "right";

export interface TestimonialConfig {
  id: string;
  quote: string;
  name: string;
  title: string;
  rating: number;
  ratingLabel: string;
  initials: string;
  avatarGradient: string;
  featured?: boolean;
  entryDirection: TestimonialEntryDirection;
  delayMs: number;
}

export interface SocialProofAvatarConfig {
  id: string;
  initials: string;
  gradient: string;
  delayMs: number;
  label: string;
}

export const TESTIMONIALS_SECTION_HEADER = {
  eyebrow: "CUSTOMER STORIES",
  headline: "Real Results. Real Impact.",
  subtext:
    "Hear from the garden centres and florists already growing with BloomSuite.",
};

export const TESTIMONIAL_CARDS_LABEL = "Customer testimonial cards";
export const TESTIMONIAL_DOTS_LABEL = "Choose a customer story";
export const TESTIMONIAL_RATING_MAX = 5;

export const TESTIMONIALS: TestimonialConfig[] = [
  {
    id: "sarah-mitchell",
    quote:
      "BloomSuite transformed how we manage customer relationships. The AI assistant alone saves us 10 hours a week.",
    name: "Sarah Mitchell",
    title: "Owner, Evergreen Garden Centre",
    rating: 5,
    ratingLabel: "5 out of 5 stars",
    initials: "SM",
    avatarGradient: "linear-gradient(135deg, #87A7BF, #30506E)",
    entryDirection: "left",
    delayMs: 120,
  },
  {
    id: "james-park",
    quote:
      "The campaign builder is incredible. We went from spending 4 hours on emails to 15 minutes — and our open rates tripled.",
    name: "James Park",
    title: "Marketing Lead, Bloom & Branch",
    rating: 5,
    ratingLabel: "5 out of 5 stars",
    initials: "JP",
    avatarGradient: "linear-gradient(135deg, #68BEB9, #30506E)",
    featured: true,
    entryDirection: "center",
    delayMs: 0,
  },
  {
    id: "maria-chen",
    quote:
      "Managing 3 locations used to be chaos. Now everything is in one dashboard and the AI handles the routine work.",
    name: "Maria Chen",
    title: "Director, Urban Roots Collective",
    rating: 5,
    ratingLabel: "5 out of 5 stars",
    initials: "MC",
    avatarGradient: "linear-gradient(135deg, #A5BDCF, #30506E)",
    entryDirection: "right",
    delayMs: 120,
  },
];

export const SOCIAL_PROOF_AVATARS: SocialProofAvatarConfig[] = [
  {
    id: "social-sm",
    initials: "SM",
    gradient: "linear-gradient(135deg, #87A7BF, #30506E)",
    delayMs: 700,
    label: "Sarah Mitchell",
  },
  {
    id: "social-jp",
    initials: "JP",
    gradient: "linear-gradient(135deg, #68BEB9, #30506E)",
    delayMs: 760,
    label: "James Park",
  },
  {
    id: "social-mc",
    initials: "MC",
    gradient: "linear-gradient(135deg, #A5BDCF, #30506E)",
    delayMs: 820,
    label: "Maria Chen",
  },
  {
    id: "social-ak",
    initials: "AK",
    gradient: "linear-gradient(135deg, #87A7BF, #30506E)",
    delayMs: 880,
    label: "Aisha Khan",
  },
  {
    id: "social-lr",
    initials: "LR",
    gradient: "linear-gradient(135deg, #68BEB9, #30506E)",
    delayMs: 940,
    label: "Leo Rivera",
  },
];

export const SOCIAL_PROOF_COUNT = {
  label: "+195",
  delayMs: 1000,
};

export const SOCIAL_PROOF_COPY = "Join 200+ green businesses already growing";

export const SOCIAL_PROOF_RATING = {
  rating: 5,
  ratingLabel: "5 out of 5 stars",
  score: "4.9 out of 5",
  reviewCount: "Based on 120+ reviews",
};
