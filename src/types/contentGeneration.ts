
export interface StyleTokens {
  use_paragraphs: boolean;
  no_emojis: boolean;
  hook_start: boolean;
  regionally_specific: boolean;
  brand_voice: 'auto' | 'custom';
  agitate_before_educate: boolean;
  visual_language: boolean;
  conversational_tone: boolean;
  clear_cta: boolean;
  natural_timing: boolean;
  enforce_company_name: boolean;
}

export interface ContentTypeRules {
  max_words: number;
  tone: string;
  format: string;
  cta_style: string;
  specific_requirements: string[];
}

export interface ClimateZoneData {
  hardiness_zone: string;
  first_frost_date: string;
  last_frost_date: string;
  common_pests: string[];
  native_plants: string[];
  seasonal_challenges: string[];
}

export interface BrandVoiceProfile {
  tone: string;
  style: string;
  traits: string[];
  use_contractions: boolean;
  expertise_level: string;
}

export interface CompanyProfile {
  company_name?: string;
  brand_voice?: string;
  tone_of_writing?: string;
  target_audience?: string;
  specializations?: string;
  location_info?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}
