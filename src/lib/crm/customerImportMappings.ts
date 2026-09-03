import type { DatabaseField } from "@/types/import";
import { normalizeCustomFieldKey } from "./customerImportSchema";

export const CUSTOMER_IMPORT_MAPPING_STORAGE_KEY =
  "bloomsuite.customer-import-mappings.v1";

type MappingStorage = Pick<Storage, "getItem" | "setItem">;

function readMappings(storage: MappingStorage): Record<string, DatabaseField> {
  try {
    const stored = storage.getItem(CUSTOMER_IMPORT_MAPPING_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, DatabaseField>)
      : {};
  } catch {
    return {};
  }
}

export function getRememberedImportField(
  storage: MappingStorage,
  csvHeader: string,
): DatabaseField | null {
  return readMappings(storage)[normalizeCustomFieldKey(csvHeader)] ?? null;
}

export function rememberImportField(
  storage: MappingStorage,
  csvHeader: string,
  databaseField: DatabaseField,
): void {
  const mappings = readMappings(storage);
  mappings[normalizeCustomFieldKey(csvHeader)] = databaseField;
  storage.setItem(
    CUSTOMER_IMPORT_MAPPING_STORAGE_KEY,
    JSON.stringify(mappings),
  );
}
