
// Re-export everything from the modular files for backward compatibility
export type {
  StyleTokens,
  ContentTypeRules,
  ClimateZoneData,
  BrandVoiceProfile,
  CompanyProfile,
  ValidationResult
} from '../../types/contentGeneration';

export {
  DEFAULT_STYLE_TOKENS,
  DEFAULT_BRAND_VOICE,
  FALLBACK_MESSAGES
} from '../../config/styleTokens';

export {
  CONTENT_TYPE_RULES
} from '../../config/contentTypeRules';

export {
  FORBIDDEN_PATTERNS,
  FORBIDDEN_PHRASES,
  validateContent
} from '../../utils/contentValidation';

// NOTE: buildContentPrompt has been moved to edge functions only
// This eliminates the conflicting prompt systems and ensures consistency
