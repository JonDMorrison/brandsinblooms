export type MtaDelivery = {
  providerMessageId: string;
  status: string;
  occurredAt: string | null;
  carrier: string | null;
  destination: string | null;
  externalId: string | null;
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

export function normalizeMtaStatus(value: unknown): string | null {
  const status = cleanString(value);
  if (!status) return null;
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeMtaDelivery(value: unknown): MtaDelivery | null {
  const row = asRecord(value);
  if (!row) return null;

  const providerMessageId = cleanString(row.messageId ?? row.message_id);
  const status = normalizeMtaStatus(row.status);
  if (!providerMessageId || !status) return null;

  const rawDate = cleanString(row.date ?? row.statusDate ?? row.updatedAt);
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const occurredAt = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toISOString()
    : null;

  return {
    providerMessageId,
    status,
    occurredAt,
    carrier: cleanString(row.carrier),
    destination: cleanString(row.to ?? row.destinationNumber),
    externalId: cleanString(row.externalId),
  };
}

export function extractMtaDeliveryRows(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return Array.isArray(data?.rows) ? data.rows : [];
}
