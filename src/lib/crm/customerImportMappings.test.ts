import { describe, expect, it } from "vitest";

import {
  CUSTOMER_IMPORT_MAPPING_STORAGE_KEY,
  getRememberedImportField,
  rememberImportField,
} from "./customerImportMappings";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("remembered customer import mappings", () => {
  it("reuses a field for equivalent CSV headers", () => {
    const storage = createStorage();
    rememberImportField(storage, "Customer Type", "custom:customer_type");

    expect(getRememberedImportField(storage, " customer-type ")).toBe(
      "custom:customer_type",
    );
  });

  it("recovers from invalid stored data", () => {
    const storage = createStorage();
    storage.values.set(CUSTOMER_IMPORT_MAPPING_STORAGE_KEY, "not-json");

    expect(getRememberedImportField(storage, "Email")).toBeNull();
    expect(() => rememberImportField(storage, "Email", "email")).not.toThrow();
  });
});
