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
  if (/(?:\bslack\b|\bbloom\b).*(?:investigation|task|handoff|ticket|support request|conversation)|(?:investigation|task|handoff|ticket|thread).*(?:\bslack\b|\bbloom\b)/i.test(text))
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

/**
 * A merge is not automatically an announcement. Development-branch merges
 * aren't customer releases, and unclassified PRs have no trustworthy summary.
 * Keep the raw PR title out of the Slack job and public message.
 */
export function announceableMainMerge(input: {
  merged: unknown;
  baseRef: unknown;
  title: unknown;
}): PublicReleaseCategory | null {
  if (input.merged !== true || input.baseRef !== "main") return null;
  const category = classifyPublicReleaseTitle(input.title);
  return category === "other" ? null : category;
}

export type PublicReleaseNote = {
  area: string;
  changed: string;
  matters: string;
  next: string;
};

const NOTES: Record<PublicReleaseCategory, PublicReleaseNote> = {
  support_tasks: {
    area: "Bloom tickets are getting easier to follow",
    changed: "We're making it easier to read a support request, see who's helping, and talk to Bloom about it right in Slack.",
    matters: "You won't have to open another screen just to understand what's happening with a customer.",
    next: "No. We'll confirm it works in the live support channel before calling it ready.",
  },
  integration_checks: {
    area: "Bloom is getting better at checking connections",
    changed: "We're improving how Bloom checks the systems that share product, inventory and order information.",
    matters: "It should be easier to spot when information stops flowing properly.",
    next: "No. We'll check the results against a real garden centre before calling it ready.",
  },
  checkout: {
    area: "Online shopping is getting smoother",
    changed: "We're improving part of the shopping cart or payment experience.",
    matters: "The goal is to help customers finish an order without getting stuck.",
    next: "No. We'll check the actual checkout before calling it ready.",
  },
  delivery: {
    area: "Orders are getting easier to manage",
    changed: "We're improving how the team handles pickup, delivery or shipping.",
    matters: "Staff should have a clearer picture of where an order stands.",
    next: "No. We'll check a real order before calling it ready.",
  },
  newsletters: {
    area: "Newsletters are getting easier to use",
    changed: "We're improving how garden centres create or send newsletters.",
    matters: "It should take less effort to get a good-looking message to customers.",
    next: "No. We'll check the newsletter experience before calling it ready.",
  },
  catalogue: {
    area: "Product information is getting better",
    changed: "We're improving how products, photos or stock information appear.",
    matters: "Customers should find the right products more easily.",
    next: "No. We'll check the affected product pages before calling it ready.",
  },
  pos: {
    area: "The cash register system is getting better",
    changed: "We're improving the tools staff use at the counter.",
    matters: "Everyday sales and stock work should become easier.",
    next: "No. We'll test the affected register task before calling it ready.",
  },
  website: {
    area: "Garden centre websites are getting easier to update",
    changed: "We're improving part of the website editing tools.",
    matters: "Making changes to a site should feel simpler and more reliable.",
    next: "No. We'll check the editor and the website before calling it ready.",
  },
  security: {
    area: "We're making customer information safer",
    changed: "We've strengthened part of the way Bloom protects information or controls access.",
    matters: "We want customer and staff information to stay in the right hands.",
    next: "No. We'll finish the safety checks before calling it ready.",
  },
  performance: {
    area: "We're working on a smoother experience",
    changed: "We're improving something that has been slow or unreliable.",
    matters: "Everyday tasks should take less time or fail less often.",
    next: "No. We'll check the original problem before calling it ready.",
  },
  projects: {
    area: "Client projects are getting easier to follow",
    changed: "We're improving how project progress and next steps are shown.",
    matters: "It should be easier to know what a client is waiting for and who is helping.",
    next: "No. We'll check the project view before calling it ready.",
  },
  support: {
    area: "Bloom is getting better at helping customers",
    changed: "We're improving how Bloom keeps track of support questions and follows up on them.",
    matters: "It should be easier to see what needs attention and who's looking after it.",
    next: "No. We'll let you know when we've checked that everything works.",
  },
  other: {
    area: "We've made an update behind the scenes",
    changed: "A change was added, but we don't have a clear team-friendly description of it yet.",
    matters: "We won't guess about what it does for customers.",
    next: "No. We'll share a clearer update when we know the result.",
  },
};

export function publicReleaseNote(value: unknown): PublicReleaseNote {
  return NOTES[isPublicReleaseCategory(value) ? value : "other"];
}
