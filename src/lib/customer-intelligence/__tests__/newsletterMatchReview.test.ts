import { describe, expect, it } from "vitest";
import { parseNewsletterCsv, previewNewsletterMatches } from "../newsletterMatchReview";
import type { IdealCustomerRow } from "../idealCustomerTypeExport";

const ideal = (CODE: string, EMAIL = "", MOBILE = "6045550100"): IdealCustomerRow => ({
  CODE, FIRSTNAME: "Anne", LASTNAME: "Gardener", MOBILE,
  EMAIL, TYPE: "VIP", MAILOUT: "N", ACCOUNT: "", PRICELEVEL: "1",
});
const csv = (rows: string) =>
  parseNewsletterCsv("Email Address,First Name,Last Name,Phone,IDEAL CODE,Status\r\n" + rows);

describe("newsletter matching preview never changes customer data", () => {
  it("parses Mailchimp aliases, quoted fields and exact leading-zero CODE", () => {
    const rows = csv('"anne@example.com","Anne, A.","Gardener","6045550100","000123","subscribed"\r\n');
    expect(rows[0].code).toBe("000123");
    expect(rows[0].firstName).toBe("Anne, A.");
    const result = previewNewsletterMatches([ideal("000123")], rows);
    expect(result.exactCode).toBe(1);
    expect(result.eligibleEmailCandidates).toBe(1);
    expect(result.rows[0].idealCode).toBe("000123");
  });
  it("does not match a shared email to multiple different Ideal records", () => {
    const result = previewNewsletterMatches(
      [ideal("000123", "shared@example.com"), ideal("000124", "shared@example.com")],
      csv("shared@example.com,Anne,Gardener,6045550100,,subscribed\r\n"),
    );
    expect(result.manualReview).toBe(1);
    expect(result.exactEmail).toBe(0);
  });
  it("flags an email that conflicts with a supplied customer CODE", () => {
    const result = previewNewsletterMatches(
      [ideal("000123", "original@example.com"), ideal("000124", "new@example.com")],
      csv("new@example.com,Anne,Gardener,6045550100,000123,subscribed\r\n"),
    );
    expect(result.manualReview).toBe(1);
    expect(result.rows[0].reason).toMatch(/conflicting/);
  });
  it("leaves name and phone matches for human review and does not infer consent", () => {
    const result = previewNewsletterMatches(
      [ideal("000123")],
      csv("anne@example.com,Anne,Gardener,6045550100,,subscribed\r\n"),
    );
    expect(result.manualReview).toBe(1);
    expect(result.exactCode).toBe(0);
    expect(result.exactEmail).toBe(0);
  });
  it("flags repeated newsletter emails and invalid source rows", () => {
    const result = previewNewsletterMatches(
      [ideal("000123")],
      csv("anne@example.com,Anne,Gardener,6045550100,000123,subscribed\r\n" +
          "ANNE@example.com,Anne,Gardener,6045550100,000123,unsubscribed\r\n"),
    );
    expect(result.manualReview).toBe(2);
    expect(() => parseNewsletterCsv("NAME,PHONE\r\nA,B")).toThrow(/EMAIL/);
    expect(() => parseNewsletterCsv("EMAIL,EMAIL\r\na@example.com,a@example.com")).toThrow(/Duplicate/);
  });
  it("never accepts unmatched supplied CODE as a silent email match", () => {
    const result = previewNewsletterMatches(
      [ideal("000123", "anne@example.com")],
      csv("anne@example.com,Anne,Gardener,6045550100,99999,subscribed\r\n"),
    );
    expect(result.manualReview).toBe(1);
  });
});
