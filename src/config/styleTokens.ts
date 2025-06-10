
import { StyleTokens, BrandVoiceProfile } from '../types/contentGeneration';

export const DEFAULT_STYLE_TOKENS: StyleTokens = {
  use_paragraphs: true,
  no_emojis: true,
  hook_start: true,
  regionally_specific: true,
  brand_voice: 'auto',
  agitate_before_educate: true,
  visual_language: true,
  conversational_tone: true,
  clear_cta: true,
  natural_timing: true,
  enforce_company_name: true
};

export const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  tone: 'Friendly but expert',
  style: 'Confident, clear, not salesy',
  traits: ['Humble', 'Trustworthy', 'Locally rooted', 'Helpful'],
  use_contractions: true,
  expertise_level: 'Local garden center expert'
};

export const FALLBACK_MESSAGES = {
  missing_location: "Write region-neutral advice that applies to a wide range of gardeners, but emphasize the importance of knowing your local climate zone.",
  missing_brand_tone: "Use a warm, conversational tone like a helpful garden center owner speaking to familiar customers.",
  missing_company_profile: "Write as a knowledgeable garden center expert providing valuable, authentic advice."
};
