import { describe, expect, it } from "vitest";

import {
  detectDelimiter,
  generateCSVTemplate,
  parseDelimitedText,
  parseCSVFile,
} from "./csvParser";

function csvFile(
  contents: string,
  size = new TextEncoder().encode(contents).byteLength,
): File {
  return {
    name: "customers.csv",
    size,
    text: async () => contents,
  } as File;
}

describe("customer CSV parsing", () => {
  it("uses the first record as headers and never imports it as a customer", async () => {
    const parsed = await parseCSVFile(
      csvFile(
        "Email,First Name,Plant Interest\njane@example.com,Jane,Tomatoes\nlee@example.com,Lee,Native plants",
      ),
    );

    expect(parsed.headers).toEqual([
      "Email",
      "First Name",
      "Plant Interest",
    ]);
    expect(parsed.dataRows).toHaveLength(2);
    expect(parsed.dataRows[0][0]).toBe("jane@example.com");
    expect(parsed.sampleData[2].samples).toEqual([
      "Tomatoes",
      "Native plants",
    ]);
  });

  it("handles BOMs, escaped quotes, quoted delimiters, and quoted newlines", async () => {
    const parsed = await parseCSVFile(
      csvFile(
        '\uFEFFEmail,Notes\r\njane@example.com,"Likes tomatoes, herbs"\r\nlee@example.com,"Said ""hello""\nand returned"',
      ),
    );

    expect(parsed.headers).toEqual(["Email", "Notes"]);
    expect(parsed.dataRows).toEqual([
      ["jane@example.com", "Likes tomatoes, herbs"],
      ["lee@example.com", 'Said "hello"\nand returned'],
    ]);
  });

  it("detects delimiters outside quoted values", () => {
    expect(detectDelimiter('Email;Notes\n"jane@example.com";"a,b,c"')).toBe(
      ";",
    );
  });

  it("parses quoted delimiters and newlines without shifting columns", () => {
    expect(
      parseDelimitedText(
        'Email,Tags,Notes\njane@example.com,"gardening,tools","First line\nSecond line"',
      ).records,
    ).toEqual([
      ["Email", "Tags", "Notes"],
      ["jane@example.com", "gardening,tools", "First line\nSecond line"],
    ]);
  });

  it("rejects delimited data beyond explicit row and column budgets", () => {
    const limits = { label: "customer import file", maxRows: 2, maxColumns: 2 };
    expect(() => parseDelimitedText("a,b\n1,2\n3,4", limits)).toThrow(
      "at most 2 rows",
    );
    expect(() => parseDelimitedText("a,b,c\n1,2,3", limits)).toThrow(
      "at most 2 columns",
    );
  });

  it("rejects duplicate, missing, and inconsistent headers before import", async () => {
    await expect(
      parseCSVFile(csvFile("Email,email\na@example.com,b@example.com")),
    ).rejects.toThrow("duplicate header");
    await expect(
      parseCSVFile(csvFile("Email,\na@example.com,Jane")),
    ).rejects.toThrow("has no header");
    await expect(
      parseCSVFile(csvFile("Email,First Name\na@example.com,Jane,extra")),
    ).rejects.toThrow("CSV row 2 has 3 columns; expected 2");
    await expect(parseCSVFile(csvFile('Email,Notes\na@example.com,"oops'))).rejects.toThrow(
      "unclosed quoted value",
    );
  });

  it("generates a template that round-trips without importing its header", async () => {
    const parsed = await parseCSVFile(csvFile(generateCSVTemplate()));
    expect(parsed.headers[0]).toBe("Email");
    expect(parsed.dataRows).toHaveLength(3);
    expect(parsed.dataRows[0][0]).toBe("john.doe@example.com");
  });

  it("accepts exact file, logical-row, and column boundaries", async () => {
    const exactRows = [
      "Email",
      ...Array.from(
        { length: 10_000 },
        (_, index) => `customer-${index}@example.com`,
      ),
    ].join("\n");
    const parsedRows = await parseCSVFile(csvFile(exactRows));
    expect(parsedRows.dataRows).toHaveLength(10_000);

    const headers = Array.from({ length: 50 }, (_, index) => `Column ${index}`);
    const values = Array.from({ length: 50 }, (_, index) => `Value ${index}`);
    const parsedColumns = await parseCSVFile(
      csvFile(`${headers.join(",")}\n${values.join(",")}`),
    );
    expect(parsedColumns.columnCount).toBe(50);

    await expect(
      parseCSVFile(csvFile("Email\nexact@example.com", 5 * 1024 * 1024)),
    ).resolves.toMatchObject({ dataRows: [["exact@example.com"]] });
  });

  it("rejects one byte, logical row, or column beyond the import boundary", async () => {
    await expect(
      parseCSVFile(csvFile("Email\ntoo-large@example.com", 5 * 1024 * 1024 + 1)),
    ).rejects.toThrow("5 MB or smaller");

    const excessRows = [
      "Email",
      ...Array.from(
        { length: 10_001 },
        (_, index) => `customer-${index}@example.com`,
      ),
    ].join("\n");
    await expect(parseCSVFile(csvFile(excessRows))).rejects.toThrow(
      "at most 10,001 rows",
    );

    const headers = Array.from({ length: 51 }, (_, index) => `Column ${index}`);
    const values = Array.from({ length: 51 }, (_, index) => `Value ${index}`);
    await expect(
      parseCSVFile(csvFile(`${headers.join(",")}\n${values.join(",")}`)),
    ).rejects.toThrow("at most 50 columns");
  });
});
