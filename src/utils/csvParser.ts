import {
  CUSTOMER_IMPORT_SPREADSHEET_LIMITS,
  assertSpreadsheetFileSize,
} from "@/lib/security/spreadsheetLimits";

/**
 * Parses one CSV record. Full-file imports use parseCSVRecords below so quoted
 * newlines can be handled correctly as part of the same record.
 */
export const parseCSVLine = (
  line: string,
  delimiter: string = ",",
): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

/**
 * Detects the delimiter from the first logical record and ignores delimiter
 * characters inside quoted values.
 */
export const detectDelimiter = (text: string): string => {
  const delimiters = [",", ";", "\t", "|"];
  const counts = new Map(delimiters.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) break;
    if (!inQuotes && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  let detectedDelimiter = ",";
  let maxCount = 0;
  for (const delimiter of delimiters) {
    const count = counts.get(delimiter) ?? 0;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }

  return detectedDelimiter;
};

export interface DelimitedTextLimits {
  label: string;
  maxRows: number;
  maxColumns: number;
}

function parseCSVRecords(
  text: string,
  delimiter: string,
  limits?: DelimitedTextLimits,
): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  const finishField = () => {
    record.push(field.trim());
    field = "";
    if (limits && record.length > limits.maxColumns) {
      throw new Error(
        `The ${limits.label} may contain at most ${limits.maxColumns} columns. Nothing was imported.`,
      );
    }
  };
  const finishRecord = () => {
    finishField();
    if (record.some((value) => value.length > 0)) {
      if (limits && records.length >= limits.maxRows) {
        throw new Error(
          `The ${limits.label} may contain at most ${limits.maxRows.toLocaleString()} rows. Nothing was imported.`,
        );
      }
      records.push(record);
    }
    record = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      finishField();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") index += 1;
      finishRecord();
      continue;
    }

    field += char;
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted value.");
  if (field.length > 0 || record.length > 0) finishRecord();
  return records;
}

export interface ParsedDelimitedText {
  delimiter: string;
  records: string[][];
}

/**
 * Parses a complete RFC 4180-style delimited document, including quoted
 * delimiters, escaped quotes, and quoted newlines. Optional limits are
 * enforced while records are built so over-budget input is never accepted
 * partially.
 */
export function parseDelimitedText(
  text: string,
  limits?: DelimitedTextLimits,
): ParsedDelimitedText {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(normalizedText);
  return {
    delimiter,
    records: parseCSVRecords(normalizedText, delimiter, limits),
  };
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const autoDetectFieldMapping = (
  headers: string[],
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const fieldPatterns = {
    email: /^(email|e[-_]?mail|customer[-_]?email|contact[-_]?email|mail)$/i,
    first_name: /^(first[-_]?name|fname|given[-_]?name|first|forename)$/i,
    last_name: /^(last[-_]?name|lname|surname|last|family[-_]?name)$/i,
    phone: /^(phone|telephone|cell|mobile|phone[-_]?number|tel)$/i,
    tags: /^(tags|interests|categories|labels)$/i,
    persona: /^(persona|customer[-_]?type|segment|category)$/i,
    sms_opt_in: /^(sms[-_]?opt[-_]?in|sms[-_]?consent|text[-_]?marketing|sms)$/i,
  };

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    for (const [field, pattern] of Object.entries(fieldPatterns)) {
      if (pattern.test(normalizedHeader)) {
        mapping[header] = field;
        break;
      }
    }
    if (!mapping[header]) mapping[header] = "skip";
  });

  return mapping;
};

export interface ParsedCSVData {
  headers: string[];
  dataRows: string[][];
  sampleData: { header: string; samples: string[] }[];
  delimiter: string;
  firstFiveRows: string[][];
  columnCount: number;
}

/**
 * Parses a conventional, header-based CSV and validates its shape before any
 * customer data is sent to the server.
 */
export const parseCSVFile = async (file: File): Promise<ParsedCSVData> => {
  assertSpreadsheetFileSize(file, CUSTOMER_IMPORT_SPREADSHEET_LIMITS);
  const { delimiter, records } = parseDelimitedText(await file.text(), {
    label: CUSTOMER_IMPORT_SPREADSHEET_LIMITS.label,
    maxRows: CUSTOMER_IMPORT_SPREADSHEET_LIMITS.maxRows,
    maxColumns: CUSTOMER_IMPORT_SPREADSHEET_LIMITS.maxColumns,
  });

  if (records.length === 0) throw new Error("CSV file is empty.");
  if (records.length === 1) {
    throw new Error("CSV file contains headers but no customer rows.");
  }

  const headers = records[0].map((header) => header.trim());
  const columnCount = headers.length;
  const emptyHeaderIndex = headers.findIndex((header) => !header);
  if (emptyHeaderIndex >= 0) {
    throw new Error(`CSV column ${emptyHeaderIndex + 1} has no header.`);
  }

  const normalizedHeaders = headers.map((header) =>
    header.toLocaleLowerCase().replace(/\s+/g, " ").trim(),
  );
  const duplicateHeader = normalizedHeaders.find(
    (header, index) => normalizedHeaders.indexOf(header) !== index,
  );
  if (duplicateHeader) {
    const originalHeader =
      headers[normalizedHeaders.lastIndexOf(duplicateHeader)];
    throw new Error(
      `CSV contains the duplicate header "${originalHeader}". Rename one column before importing.`,
    );
  }

  const dataRows = records.slice(1);
  const inconsistentRowIndex = dataRows.findIndex(
    (row) => row.length !== columnCount,
  );
  if (inconsistentRowIndex >= 0) {
    throw new Error(
      `CSV row ${inconsistentRowIndex + 2} has ${dataRows[inconsistentRowIndex].length} columns; expected ${columnCount}.`,
    );
  }

  const firstFiveRows = dataRows.slice(0, 5);
  const sampleData = headers.map((header, index) => ({
    header,
    samples: firstFiveRows.map((row) => row[index] || ""),
  }));

  return {
    headers,
    dataRows,
    sampleData,
    delimiter,
    firstFiveRows,
    columnCount,
  };
};

export const generateCSVTemplate = (): string => {
  const headers = [
    "Email",
    "First Name",
    "Last Name",
    "Phone",
    "Tags",
    "Persona",
    "SMS Opt-In",
  ];
  const sampleRows = [
    [
      "john.doe@example.com",
      "John",
      "Doe",
      "+1234567890",
      "vip,premium",
      "High Value",
      "yes",
    ],
    [
      "jane.smith@example.com",
      "Jane",
      "Smith",
      "+1987654321",
      "new",
      "New Customer",
      "no",
    ],
    [
      "bob.wilson@example.com",
      "Bob",
      "Wilson",
      "",
      "frequent",
      "Frequent Buyer",
      "yes",
    ],
  ];

  return [
    headers.join(","),
    ...sampleRows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");
};
