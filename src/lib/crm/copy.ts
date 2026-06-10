/**
 * Garden-center language glossary for BloomSuite CRM.
 *
 * One source of truth. Every user-visible string that names a CRM concept
 * should come through here. Keep the keys technical (they match how engineers
 * refer to the thing); keep the values plain English for a busy garden centre
 * owner who took over marketing because nobody else would.
 *
 * Rules:
 * - Segment and persona keep their names — they're shop-owner-grade words.
 *   Use SEGMENT_TOOLTIP / PERSONA_TOOLTIP next to first mentions instead.
 * - Never use the letters A-I as a standalone word in any value. The product
 *   speaks; it doesn't announce that it's speaking.
 * - Prefer everyday verbs ("waiting for permission") over status nouns
 *   ("pending confirmation").
 * - Anything technical (suppression list, DKIM, queue) is fine *inside an
 *   explainer*, but it should never be the primary label.
 */

export const CRM_COPY = {
  // ───── consent + permission ─────
  consentCheck: "Permission check",
  consentCheckDescription:
    "We only send marketing email to people who said yes.",
  pendingConfirmation: "Waiting for permission",
  pendingConfirmationShort: "Waiting for permission",
  pendingConfirmationHelper:
    "We don't have a recorded yes from these contacts yet. They won't receive marketing email until they confirm.",
  optedIn: "Said yes to email",
  optedOut: "Asked to stop",
  optedOutPlural: "Asked us to stop",

  // ───── suppression + bounces ─────
  suppressionList: "People we can't send to",
  suppressionListHelper:
    "Addresses that should stay blocked — usually because of bounces, complaints, or unsubscribes.",
  hardBounce: "Bad address",
  hardBounceHelper:
    "Mail keeps coming back as undeliverable. We won't send to this address again.",
  softBounce: "Temporary delivery problem",
  softBounceHelper:
    "The address didn't accept mail this time — could be a full inbox or a server hiccup. We'll try again later.",

  // ───── deliverability ─────
  inboxHealth: "Inbox health",
  inboxHealthHelper:
    "How well your emails are landing — based on bounces, complaints, and how often your contacts open what you send.",
  senderReputation: "How mail providers see you",
  senderReputationNoScore:
    "We'll show this once you've sent a few campaigns. New senders take a couple of weeks to build a track record.",

  // ───── audience ─────
  audienceQuestion: "Who will receive this?",
  willBeSentTo: "Will be sent to about",
  noAudienceSelected: "No audience selected",

  // ───── send pipeline ─────
  sendingStarted: "Sending started",
  queuedShort: "Sending started",
  willSendTo: "Will be sent to",

  // ───── automation ─────
  followUpSeries: "Follow-up series",

  // ───── merge tags ─────
  mergeTagsLabel: "Fill in the blanks",
  mergeTagsHelper:
    "Drop in things like first name, business name, or city so each person sees their own details.",

  // ───── DNS / sender domain ─────
  senderDomainSetupTitle: "Prove you own your email address",
  senderDomainSetupSubtitle:
    "One-time setup so your shop's email lands in inboxes instead of spam. Takes about 10 minutes.",

  // ───── status framing ─────
  lifecycleNew: "New",
  lifecycleRegular: "Regular",
  lifecycleQuiet: "Haven't seen lately",

  // ───── engagement ─────
  engagementHigh: "Opens often",
  engagementMedium: "Opens sometimes",
  engagementLow: "Hasn't opened lately",
} as const;

export type CrmCopyKey = keyof typeof CRM_COPY;

/**
 * Tooltip text for the two terms we kept (segment, persona). Surface near the
 * first mention on each page — once is enough; don't decorate every chip.
 */
export const SEGMENT_TOOLTIP =
  "A segment is a group of customers who go together — like big spenders, weekend regulars, or people new this season. Send the right message to the right group.";

export const PERSONA_TOOLTIP =
  "A persona is a type of customer — like brand new to gardening, regular customer, or master gardener. Personas shape what you say; segments decide who hears it.";

/**
 * Three plain-English status states used in pre-send review and audience
 * health surfaces. Mirrors the Approved / Protected / Blocked cards shipped in
 * #64 — centralising the labels so we don't drift across surfaces.
 */
export const AUDIENCE_STATUS_LABELS = {
  approved: "Ready to receive this",
  approvedHelper: "These contacts can receive this campaign right now.",
  protected: "Held back to protect you",
  protectedHelper:
    "Held back to protect your inbox health and the trust of your contacts.",
  blocked: "Can't be sent to",
  blockedHelper:
    "Addresses that should stay blocked — usually because of bounces, complaints, or unsubscribes.",
} as const;
