// Keep identity resolution, consent writes, and customer triggers below the
// authenticated API statement timeout. Requests run sequentially.
export const CUSTOMER_IMPORT_BATCH_SIZE = 5;

export type ImportBatchOutcome<R> =
  | { offset: number; count: number; result: R; error?: never }
  | { offset: number; count: number; error: unknown; result?: never };

export async function importCustomerBatch<T, R>(
  customers: T[],
  submit: (customers: T[]) => Promise<R>,
  offset = 0,
): Promise<ImportBatchOutcome<R>[]> {
  try {
    const result = await submit(customers);
    return [{ offset, count: customers.length, result }];
  } catch (error) {
    // A Postgres cancellation rolls back the entire RPC transaction. Split
    // only this explicit response; network errors have an unknown commit state.
    if (
      error && typeof error === "object" &&
      "code" in error && error.code === "57014" && customers.length > 1
    ) {
      const middle = Math.ceil(customers.length / 2);
      const first = await importCustomerBatch(customers.slice(0, middle), submit, offset);
      const second = await importCustomerBatch(customers.slice(middle), submit, offset + middle);
      return [...first, ...second];
    }
    return [{ offset, count: customers.length, error }];
  }
}

export function getCustomerImportOutcome(result: {
  imported: number;
  failed: number;
  skipped: number;
  errors: string[];
}) {
  if (result.imported === 0) return "No Customers Imported";
  if (result.failed > 0 || result.skipped > 0 || result.errors.length > 0) {
    return "Import Needs Review";
  }
  return "Import Complete";
}
