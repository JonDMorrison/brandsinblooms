
export interface ContentTypeRules {
  max_words: number;
  tone: string;
  format: string;
  cta_style: string;
  specific_requirements: string[];
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
