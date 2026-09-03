export type MtaSendAcceptance = {
  messageId: string | null;
  totalSent: number | null;
  totalFailedInternationalRecipients: number | null;
  outboundIds: string[];
};

export type MtaRecipientValidation = {
  validRecipients: unknown[];
  invalidRecipients: Array<{
    recipient: string | null;
    error: string | null;
  }>;
  hasUnsubscribedRecipient: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The MTA v3 send contract nests the provider identifier under data.messageId.
 * Deliberately do not accept top-level IDs: that was the source of fabricated
 * tracking identifiers in the legacy implementation.
 */
export function extractMtaSendAcceptance(payload: unknown): MtaSendAcceptance {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const outboundIds = Array.isArray(data?.outboundIds)
    ? data.outboundIds.map(cleanString).filter((value): value is string => value !== null)
    : [];

  return {
    messageId: cleanString(data?.messageId),
    totalSent: finiteNumber(data?.totalSent),
    totalFailedInternationalRecipients: finiteNumber(data?.totalFailedInternationalRecipients),
    outboundIds,
  };
}

/** Parse the documented data.validRecipients/data.invalidRecipients shape. */
export function extractMtaRecipientValidation(payload: unknown): MtaRecipientValidation {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const validRecipients = Array.isArray(data?.validRecipients) ? data.validRecipients : [];
  const invalidRecipients = (Array.isArray(data?.invalidRecipients) ? data.invalidRecipients : [])
    .map((value) => {
      const row = asRecord(value);
      if (!row) return null;
      return {
        recipient: cleanString(row.number ?? row.email),
        error: cleanString(row.error),
      };
    })
    .filter((value): value is { recipient: string | null; error: string | null } => value !== null);

  return {
    validRecipients,
    invalidRecipients,
    hasUnsubscribedRecipient: invalidRecipients.some(({ error }) =>
      error ? /unsubscrib|opt(?:ed)?\s*out|\bstop\b/i.test(error) : false
    ),
  };
}

/** MTA documents X-Request-Id as alphanumeric. */
export function toMtaRequestId(externalId: string): string {
  const value = externalId.replace(/[^a-zA-Z0-9]/g, "");
  if (!value) throw new Error("A non-empty external ID is required");
  return `bloomsuite${value}`;
}
