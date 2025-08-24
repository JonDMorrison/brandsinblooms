import { triggerCatalog, getTriggerById } from './triggerCatalog';

/**
 * Legacy trigger ID mappings to canonical IDs
 */
const LEGACY_TRIGGER_MAPPINGS: Record<string, string> = {
  // Legacy -> Canonical
  'customer_birthday': 'birthday',
  'event_rsvp': 'event_registration',
  'newsletter_signup': 'garden_tips_subscription',
  'newsletter_opt_in': 'garden_tips_subscription',
  'new_customer': 'loyalty_join',
  'repeat_purchase_30d': 'repeat_purchase_90d',
  'repeat_purchase_180d': 'repeat_purchase_90d',
  'plant_care': 'plant_care_reminder',
  'holiday_promo': 'holiday_promo', // Already canonical
  'manual': 'loyalty_join', // Default fallback
};

/**
 * Normalizes a trigger ID to its canonical form
 * @param id - The trigger ID to normalize (could be legacy or canonical)
 * @returns The canonical trigger ID
 */
export function normalizeTriggerId(id: string): string {
  // If it's already in the canonical catalog, return as-is
  if (getTriggerById(id)) {
    return id;
  }

  // Check legacy mappings
  const canonical = LEGACY_TRIGGER_MAPPINGS[id];
  if (canonical && getTriggerById(canonical)) {
    return canonical;
  }

  // If no mapping found, try to find a close match or return default
  console.warn(`Unknown trigger ID: ${id}, falling back to loyalty_join`);
  return 'loyalty_join';
}

/**
 * Gets all available canonical trigger IDs
 */
export function getCanonicalTriggerIds(): string[] {
  return triggerCatalog.map(trigger => trigger.id);
}

/**
 * Validates if a trigger ID is canonical (exists in the catalog)
 */
export function isCanonicalTriggerId(id: string): boolean {
  return !!getTriggerById(id);
}

/**
 * Maps legacy trigger ID to canonical with metadata
 */
export function mapLegacyToCanonical(legacyId: string): {
  canonical: string;
  wasLegacy: boolean;
  originalId: string;
} {
  const canonical = normalizeTriggerId(legacyId);
  const wasLegacy = canonical !== legacyId && !isCanonicalTriggerId(legacyId);
  
  return {
    canonical,
    wasLegacy,
    originalId: legacyId
  };
}