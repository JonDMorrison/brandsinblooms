import { describe, expect, it } from "vitest";
import {
  INTELLIGENCE_QUESTIONS,
  bloomIntelligencePrompt,
  bloomIntelligenceUrl,
  growthExplainerQuestion,
  intelligenceView,
  productExplorationQuestion,
} from "../intelligenceExperience";

describe("the Intelligence and Bloom handoff", () => {
  it("keeps an explicit trusted return section and user question", () => {
    const url = new URL(
      bloomIntelligenceUrl(INTELLIGENCE_QUESTIONS.slower, "explore"),
      "https://example.test",
    );
    expect(url.pathname).toBe("/bloom");
    expect(url.searchParams.get("origin")).toBe("intelligence");
    expect(url.searchParams.get("returnView")).toBe("explore");
    expect(url.searchParams.get("prompt")).toContain("seasonal patterns");
    expect(url.searchParams.get("prompt")).toContain("Do not send");
    expect(url.searchParams.get("prompt")).not.toContain("undefined");
  });
  it("cannot turn a return parameter into an open redirect", () => {
    expect(intelligenceView("//example.test")).toBe("overview");
    expect(intelligenceView("data")).toBe("data");
  });
  it("keeps the exact product string inside a quoted query, without guessing filters", () => {
    expect(productExplorationQuestion('Hydrangea "Pink"')).toContain(
      JSON.stringify('Hydrangea "Pink"'),
    );
    expect(() => productExplorationQuestion(" ")).toThrow();
    expect(() => productExplorationQuestion("x".repeat(181))).toThrow();
  });
  it("requires a nonempty question and adds data and consent safeguards", () => {
    expect(bloomIntelligencePrompt("What changed?")).toContain(
      "Missing records are not zeros",
    );
    expect(() => bloomIntelligencePrompt("")).toThrow();
    expect(() => bloomIntelligencePrompt("x".repeat(1401))).toThrow();
  });
  it("passes the chosen comparison dates and weights for independent checking", () => {
    const s = growthExplainerQuestion({
      baselineStart: "2025-10-01",
      baselineEnd: "2025-10-15",
      currentStart: "2026-10-01",
      currentEnd: "2026-10-15",
      currency: "CAD",
      spendWeight: 50,
      visitsWeight: 50,
      perDayRates: false,
    });
    expect(s).toContain("2025-10-01");
    expect(s).toContain("2026-10-15");
    expect(s).toContain("50% spending");
    expect(s).toContain("50% completed");
    expect(s).toContain("unknown history");
  });
});
