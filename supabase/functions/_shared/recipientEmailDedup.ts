/**
 * One copy of a campaign per email address.
 *
 * Audience resolution already removes repeated customer IDs, so a contact in
 * several selected segments is loaded once. Two separate customer records can
 * still share one address (for example "Pat@Example.com" and "pat@example.com").
 * This keeps exactly one of them.
 *
 * Policy, in order:
 * 1. Addresses are compared after trimming and lower-casing. Nothing else is
 *    rewritten. Plus tags and dots stay significant.
 * 2. If any loaded record for an address has opted out or is suppressed, the
 *    address is dropped. The most restrictive record wins.
 * 3. Otherwise the oldest record is kept (created_at, then id), so the choice
 *    is the same on every run and a resumed send targets the same customer row.
 *
 * No customer rows are merged or changed.
 */

export interface DedupableRecipient {
  id: string;
  email?: string | null;
  email_opt_in?: boolean | null;
  suppressed?: boolean | null;
  created_at?: string | null;
}

export interface RecipientEmailDedupResult<T> {
  recipients: T[];
  /** Extra records dropped because another record has the same address. */
  duplicateRecords: T[];
  /** Records dropped because a record with the same address opted out or is suppressed. */
  restrictedRecords: T[];
}

export function normalizeRecipientEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function compareOldestFirst(a: DedupableRecipient, b: DedupableRecipient): number {
  const aTime = Date.parse(a.created_at ?? "");
  const bTime = Date.parse(b.created_at ?? "");
  const aKnown = Number.isFinite(aTime);
  const bKnown = Number.isFinite(bTime);
  if (aKnown && bKnown && aTime !== bTime) return aTime - bTime;
  if (aKnown !== bKnown) return aKnown ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

export function dedupeRecipientsByEmail<T extends DedupableRecipient>(
  recipients: readonly T[],
  options: { respectOptOut?: boolean } = {},
): RecipientEmailDedupResult<T> {
  const respectOptOut = options.respectOptOut !== false;
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  const passthrough: T[] = [];

  for (const recipient of recipients) {
    const key = normalizeRecipientEmail(recipient.email);
    if (!key) {
      passthrough.push(recipient);
      continue;
    }
    const group = groups.get(key);
    if (group) {
      group.push(recipient);
    } else {
      groups.set(key, [recipient]);
      order.push(key);
    }
  }

  const kept: T[] = [...passthrough];
  const duplicateRecords: T[] = [];
  const restrictedRecords: T[] = [];

  for (const key of order) {
    const group = groups.get(key) ?? [];
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const restricted =
      respectOptOut &&
      group.some((r) => r.email_opt_in === false || r.suppressed === true);
    if (restricted) {
      restrictedRecords.push(...group);
      continue;
    }
    const sorted = [...group].sort(compareOldestFirst);
    kept.push(sorted[0]);
    duplicateRecords.push(...sorted.slice(1));
  }

  return { recipients: kept, duplicateRecords, restrictedRecords };
}
