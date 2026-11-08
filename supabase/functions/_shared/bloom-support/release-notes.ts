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
    changed: "We're making it easier to follow the same support task in Slack and Bloom.",
    matters: "Staff will be able to see the same task, evidence and follow-up in either place once the change is live.",
    next: "Try one Slack request and check the same task in Bloom.",
  },
  integration_checks: {
    area: "Connected business systems",
    changed: "Bloom is getting better at checking whether connected systems are working.",
    matters: "Staff can more easily spot a connection that receives data but is not fully working.",
    next: "Check a real connection and the latest results.",
  },
  checkout: {
    area: "Online checkout",
    changed: "We're improving how customers complete their orders online.",
    matters: "This is intended to make it easier for customers to complete purchases.",
    next: "Test the affected checkout safely.",
  },
  delivery: {
    area: "Orders and delivery",
    changed: "We're improving how pickup and delivery orders are handled.",
    matters: "Garden centre staff should have a clearer way to process customer orders once the change is live.",
    next: "Check an affected order from start to finish.",
  },
  newsletters: {
    area: "Newsletters",
    changed: "We're improving how newsletters are made and sent.",
    matters: "Staff should have a simpler and more reliable newsletter workflow after deployment.",
    next: "Try the affected newsletter task.",
  },
  catalogue: {
    area: "Product listings",
    changed: "We're improving how product details and photos appear.",
    matters: "Customers and staff should have more reliable product information after deployment.",
    next: "Check the affected products in the shop.",
  },
  pos: {
    area: "Point of sale",
    changed: "We're improving the tools staff use at the checkout counter.",
    matters: "This is intended to make everyday counter and inventory work easier.",
    next: "Test the affected counter task.",
  },
  website: {
    area: "Website editing",
    changed: "We're improving how garden centres update their websites.",
    matters: "Garden centres should find website updates easier or more reliable after deployment.",
    next: "Check the affected page on the website.",
  },
  security: {
    area: "Security and access",
    changed: "We're making a change to help protect customer and staff information.",
    matters: "The change is intended to keep customer and staff information safer.",
    next: "Check that the access rules still work.",
  },
  performance: {
    area: "Reliability and speed",
    changed: "We're working to make everyday tasks faster and more reliable.",
    matters: "This work aims to reduce delays or failures in everyday use.",
    next: "Repeat the task that was slow or failing.",
  },
  projects: {
    area: "Major Projects",
    changed: "We're improving how the team follows project progress.",
    matters: "Staff should be able to follow progress and next actions more clearly after deployment.",
    next: "Check the project list and links in Bloom.",
  },
  support: {
    area: "Customer support",
    changed: "We're making customer support requests easier to follow.",
    matters: "Staff should find it easier to identify problems and follow them through.",
    next: "Test a support request from start to finish.",
  },
  other: {
    area: "Software",
    changed: "Something has changed, but we don't yet have a confirmed explanation of what it means for customers.",
    matters: "Its impact cannot be determined safely from the release notification alone.",
    next: "Find out what changed and test it before sharing an update.",
  },
};

export function publicReleaseNote(value: unknown): PublicReleaseNote {
  return NOTES[isPublicReleaseCategory(value) ? value : "other"];
}
