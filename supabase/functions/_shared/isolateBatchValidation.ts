export type BatchItemResult = { id?: string; error?: string; status?: number };
export type BatchSendResult = {
  ids?: BatchItemResult[];
  error?: string;
  status?: number;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
};

/**
 * Strict validation rejects the entire request before creating any emails.
 * Split only explicit validation failures. Never split ambiguous/network
 * failures, rate limits, or successful requests: those must retain their key.
 */
export async function isolateBatchValidation<T>(
  payloads: T[],
  seed: string,
  send: (payloads: T[], seed: string) => Promise<BatchSendResult>,
): Promise<BatchSendResult> {
  const response = await send(payloads, seed);
  if (response.ids || response.rateLimited ||
      ![400, 422].includes(response.status ?? 0) ||
      !/invalid .*field|header keys and values|validation/i.test(response.error ?? "")) {
    return response;
  }
  if (payloads.length === 1) {
    return { ids: [{ error: response.error, status: response.status }], status: response.status };
  }
  const middle = Math.floor(payloads.length / 2);
  const leftPayloads = payloads.slice(0, middle);
  const rightPayloads = payloads.slice(middle);
  const left = await isolateBatchValidation(leftPayloads, seed + ":left", send);
  // Keep per-recipient results even if a sibling encounters a transient error.
  const right = await isolateBatchValidation(rightPayloads, seed + ":right", send);
  const expand = (result: BatchSendResult, count: number): BatchItemResult[] =>
    result.ids ?? Array.from({ length: count }, () => ({
      error: result.error ?? "Batch send failed", status: result.status,
    }));
  return { ids: [...expand(left, leftPayloads.length), ...expand(right, rightPayloads.length)] };
}
