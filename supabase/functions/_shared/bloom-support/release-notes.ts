/**
 * Safe, cost-free, deterministic GitHub release classification.
 *
 * A PR title is untrusted and may contain a customer's name, email, secrets,
 * or hostile text. It is ONLY used to select a pre-reviewed category; none of
 * its bytes may be posted to Slack or saved to the jobs queue.
 */
export const PUBLIC_RELEASE_CATEGORIES = [
  "support_tasks", "integration_checks", "checkout", "delivery",
  "newsletters", "catalogue", "pos", "website", "security",
  "performance", "projects", "support", "other",
] as const;
export type PublicReleaseCategory = typeof PUBLIC_RELEASE_CATEGORIES[number];

export function isPublicReleaseCategory(value: unknown): value is PublicReleaseCategory {
  return typeof value === "string" &&
    (PUBLIC_RELEASE_CATEGORIES as readonly string[]).includes(value);
}

export function classifyPublicReleaseTitle(value: unknown): PublicReleaseCategory {
  if (typeof value !== "string" || value.length < 4 || value.length > 220) return "other";
  // A known category never requires reading or publishing sensitive source text.
  const text = value.toLowerCase();
  if (/(?:password|private key|secret|api.key|token|credential|sk_live_|xox[baprs]-)/i.test(text)) return "other";
  if (/(?:\bslack\b|\bbloom\b).*(?:investigation|task|handoff)|(?:investigation|task).*(?:\bslack\b|\bbloom\b)/i.test(text))
    return "support_tasks";
  if (/counter\s?point|open plant data|\bopd\b|heartland|shipstation|integration (?:diagnostic|health)|(?:diagnostic|health) (?:of |for )?integration/i.test(text))
    return "integration_checks";
  if (/checkout|payment|cart|stripe session/i.test(text)) return "checkout";
  if (/delivery|shipping|pickup|fulfilment|fulfillment/i.test(text)) return "delivery";
  if (/newsletter|campaign|email designer|email deliver|send campaign/i.test(text)) return "newsletters";
  if (/catalogue|catalog|inventory|product image|product list|product filter|bulk upload/i.test(text)) return "catalogue";
  if (/\bpos\b|point.of.sale|\bbloomtill\b|cashier|receipt|barcode/i.test(text)) return "pos";
  if (/site design|website|page edit|navigation|theme|site builder|page publish|hero image/i.test(text)) return "website";
  if (/security|authorization|authentication|permission|credential|role.based|privacy/i.test(text)) return "security";
  if (/performance|timeout|speed|latency|query optimiz/i.test(text)) return "performance";
  if (/major project|onboarding|project handoff|project status/i.test(text)) return "projects";
  if (/support|ticket|help desk|ask bloom|\bslack\b/i.test(text)) return "support";
  return "other";
}

export type PublicReleaseNote = {
  area: string;
  changed: string;
  matters: string;
  next: string;
};

const NOTES: Record<PublicReleaseCategory, PublicReleaseNote> = {
  support_tasks: {
    area: "Bloom investigations",
    changed: "The team added work to keep Slack requests and Bloom dashboard investigations linked to a single support task.",
    matters: "Staff will be able to see the same task, evidence and follow-up in either place once the change is live.",
    next: "Confirm the release in production, then verify a real Slack task and its dashboard record.",
  },
  integration_checks: {
    area: "Connected business systems",
    changed: "The team improved Bloom's ability to check integration settings and recent synchronization results.",
    matters: "Staff can more easily spot a connection that receives data but is not fully working.",
    next: "Confirm deployment and check the original integration workflow.",
  },
  checkout: {
    area: "Online checkout",
    changed: "The team merged an improvement to shopping carts, checkout or payments.",
    matters: "This is intended to make it easier for customers to complete purchases.",
    next: "Check the production release and test an actual checkout.",
  },
  delivery: {
    area: "Orders and delivery",
    changed: "The team merged an improvement to delivery, pickup or order handling.",
    matters: "Garden centre staff should have a clearer way to process customer orders once the change is live.",
    next: "Check the production release and test the affected order flow.",
  },
  newsletters: {
    area: "Newsletters",
    changed: "The team merged an improvement to creating or sending email campaigns.",
    matters: "Staff should have a simpler and more reliable newsletter workflow after deployment.",
    next: "Confirm the release and test an appropriate draft or safe email flow.",
  },
  catalogue: {
    area: "Product listings",
    changed: "The team merged an improvement to product information, photos or inventory display.",
    matters: "Customers and staff should have more reliable product information after deployment.",
    next: "Check the actual shop catalogue and the original reported problem.",
  },
  pos: {
    area: "Point of sale",
    changed: "The team merged a point-of-sale improvement.",
    matters: "This is intended to make everyday counter and inventory work easier.",
    next: "Verify the POS release and the affected cashier workflow.",
  },
  website: {
    area: "Website editing",
    changed: "The team merged an improvement to building, editing or publishing websites.",
    matters: "Garden centres should find website updates easier or more reliable after deployment.",
    next: "Check the live website and the original editing workflow.",
  },
  security: {
    area: "Security and access",
    changed: "The team merged an improvement to how access or sensitive information is protected.",
    matters: "The change is intended to keep customer and staff information safer.",
    next: "Confirm the security checks, deployment and affected access controls.",
  },
  performance: {
    area: "Reliability and speed",
    changed: "The team merged a reliability or performance improvement.",
    matters: "This work aims to reduce delays or failures in everyday use.",
    next: "Verify the production release and the previously slow or failing task.",
  },
  projects: {
    area: "Major Projects",
    changed: "The team merged an improvement to project tracking or onboarding.",
    matters: "Staff should be able to follow progress and next actions more clearly after deployment.",
    next: "Verify that project records and links work in the live dashboard.",
  },
  support: {
    area: "Customer support",
    changed: "The team merged an improvement to how Bloom handles support requests.",
    matters: "Staff should find it easier to identify problems and follow them through.",
    next: "Check deployment and test the affected support workflow.",
  },
  other: {
    area: "Software",
    changed: "A code change was merged. A specific, approved customer-facing description is not available for this change.",
    matters: "Its impact cannot be determined safely from the release notification alone.",
    next: "Open the linked change, confirm the outcome, and add a reviewed plain-English update if needed.",
  },
};

export function publicReleaseNote(value: unknown): PublicReleaseNote {
  return NOTES[isPublicReleaseCategory(value) ? value : "other"];
}
