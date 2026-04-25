import { describe, expect, it } from "vitest";
import { sanitizeSearchAnalyticsQuery } from "@/components/search/searchAnalytics";

describe("searchAnalytics", () => {
  it("redacts emails and phone numbers before tracking queries", () => {
    expect(
      sanitizeSearchAnalyticsQuery("jane@example.com +1 (555) 111-2222 vip orchids"),
    ).toContain("[redacted-email]");

    expect(
      sanitizeSearchAnalyticsQuery("jane@example.com +1 (555) 111-2222 vip orchids"),
    ).toContain("[redacted-phone]");
  });

  it("truncates sanitized queries to fifty characters", () => {
    expect(
      sanitizeSearchAnalyticsQuery(
        "this is a deliberately long search query that should be clipped after fifty characters",
      ),
    ).toHaveLength(50);
  });
});