import { describe, expect, it } from "vitest";

import {
  detectDelimiter,
  generateCSVTemplate,
  parseCSVFile,
} from "./csvParser";

function csvFile(contents: string): File {
  return {
    name: "customers.csv",
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
});
