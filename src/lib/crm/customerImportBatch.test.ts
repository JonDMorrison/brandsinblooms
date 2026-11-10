import { describe, expect, it, vi } from "vitest";
import { CUSTOMER_IMPORT_BATCH_SIZE, getCustomerImportOutcome, importCustomerBatch } from "./customerImportBatch";

describe("customer import timeout recovery", () => {
  it("imports a 176-row list in bounded sequential requests", async () => {
    const rows = Array.from({ length: 176 }, (_, i) => i);
    const imported: number[] = [];
    const submit = vi.fn(async (batch: number[]) => {
      expect(batch.length).toBeLessThanOrEqual(5);
      imported.push(...batch);
      return { imported: batch.length };
    });
    for (let i = 0; i < rows.length; i += CUSTOMER_IMPORT_BATCH_SIZE) {
      await importCustomerBatch(rows.slice(i, i + CUSTOMER_IMPORT_BATCH_SIZE), submit, i);
    }
    expect(submit).toHaveBeenCalledTimes(36);
    expect(imported).toEqual(rows);
  });

  it("splits a rolled-back timeout without duplicating successful rows", async () => {
    const committed: number[] = [];
    const outcomes = await importCustomerBatch([0, 1, 2, 3, 4], async (rows) => {
      if (rows.length > 2) throw { code: "57014", message: "statement timeout" };
      committed.push(...rows);
      return rows.length;
    }, 25);
    expect(committed).toEqual([0, 1, 2, 3, 4]);
    expect(outcomes.map((o) => o.offset)).toEqual([25, 27, 28]);
    expect(outcomes.reduce((sum, o) => sum + (o.result ?? 0), 0)).toBe(5);
  });

  it("does not retry ambiguous network failures or authorization errors", async () => {
    for (const error of [new Error("Failed to fetch"), { code: "42501" }]) {
      const submit = vi.fn(async () => { throw error; });
      const outcomes = await importCustomerBatch([1, 2], submit);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(outcomes).toEqual([{ offset: 0, count: 2, error }]);
    }
  });

  it("terminates recovery at one row and keeps later successes", async () => {
    const outcomes = await importCustomerBatch([1, 2], async (rows) => {
      if (rows.includes(1)) throw { code: "57014" };
      return rows.length;
    });
    expect(outcomes[0]).toMatchObject({ offset: 0, count: 1, error: { code: "57014" } });
    expect(outcomes[1]).toEqual({ offset: 1, count: 1, result: 1 });
  });
});

describe("customer import outcome", () => {
  const success = { imported: 176, failed: 0, skipped: 0, errors: [] };
  it("shows success only for a clean import", () => {
    expect(getCustomerImportOutcome(success)).toBe("Import Complete");
    expect(getCustomerImportOutcome({ ...success, failed: 1 })).toBe("Import Needs Review");
    expect(getCustomerImportOutcome({ ...success, skipped: 1 })).toBe("Import Needs Review");
    expect(getCustomerImportOutcome({ ...success, errors: ["Segment assignment failed"] })).toBe("Import Needs Review");
  });
  it("never shows success when no customers were imported", () => {
    expect(getCustomerImportOutcome({ ...success, imported: 0, failed: 176 })).toBe("No Customers Imported");
    expect(getCustomerImportOutcome({ ...success, imported: 0, skipped: 176 })).toBe("No Customers Imported");
  });
});
